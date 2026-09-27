// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  createXlsxWorkbook,
  xlsxCellRef,
  xlsxColumnName,
  xlsxRangeRef,
  type XlsxFreeSheet,
  type XlsxSheet,
} from "@/server/shared/xlsx";

import { bacaZip, uraiXml } from "./eviden-skp-baca";

/**
 * ============================================================================
 * server/shared/xlsx.ts 2.40.0 - LEMBAR BEBAS
 * ============================================================================
 *
 * Lembar bebas (sel bergaya, sel gabung, gambar, pengaturan cetak) ditambahkan
 * untuk eviden SKP DI SAMPING bentuk lama. Yang dijaga:
 *
 *   1. Buku kerja yang hanya berisi XlsxSheet - ekspor e-Kepegawaian, laporan
 *      bot, pemantauan SIPP - ditulis sama persis seperti sebelumnya (dipin).
 *   2. Di buku kerja campuran, gaya lama tetap bernomor 0-2, sehingga lembar
 *      lama tidak tiba-tiba berganti warna kepala.
 *   3. Kemampuan baru tertulis sah dan bermakna seperti yang dimaksud.
 */

const LOGO = readFileSync(path.join(process.cwd(), "public", "mahkamah-agung-logo.png"));
const teks = (b: Buffer, nama: string) => bacaZip(b).get(nama)?.toString("utf8") ?? "";

const LAMA: XlsxSheet = { name: "Data", columns: [{ key: "a", header: "A", width: 10 }], rows: [{ a: "x" }] };

const GAYA_LAMA =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>' +
  '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E79"/><bgColor indexed="64"/></patternFill></fill></fills>' +
  '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD9E2EC"/></left><right style="thin"><color rgb="FFD9E2EC"/></right><top style="thin"><color rgb="FFD9E2EC"/></top><bottom style="thin"><color rgb="FFD9E2EC"/></bottom><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  "</styleSheet>";

describe("pemakai lama - buku kerja XlsxSheet dipin", () => {
  it("lembar, buku kerja, gaya, dan daftar isi sama seperti sebelumnya", () => {
    const b = createXlsxWorkbook([LAMA], { createdAt: new Date("2026-01-01T00:00:00Z") });
    expect(teks(b, "xl/worksheets/sheet1.xml")).toBe(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<dimension ref="A1:A2"/><sheetViews><sheetView workbookViewId="0"/></sheetViews>' +
        '<cols><col min="1" max="1" width="10" customWidth="1"/></cols>' +
        '<sheetData><row r="1" ht="22" customHeight="1"><c r="A1" s="1" t="inlineStr"><is><t xml:space="preserve">A</t></is></c></row>' +
        '<row r="2"><c r="A2" s="2" t="inlineStr"><is><t xml:space="preserve">x</t></is></c></row></sheetData>' +
        '<autoFilter ref="A1:A2"/></worksheet>'
    );
    expect(teks(b, "xl/workbook.xml")).toBe(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<bookViews><workbookView/></bookViews><sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets></workbook>'
    );
    expect(teks(b, "xl/styles.xml")).toBe(GAYA_LAMA);
    expect([...bacaZip(b).keys()]).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "docProps/core.xml",
      "docProps/app.xml",
      "xl/workbook.xml",
      "xl/_rels/workbook.xml.rels",
      "xl/styles.xml",
      "xl/worksheets/sheet1.xml",
    ]);
    const jenis = teks(b, "[Content_Types].xml");
    expect(jenis).not.toContain("png");
    expect(jenis).not.toContain("drawing");
  });
});

const BEBAS = (ubah: Partial<XlsxFreeSheet> = {}): XlsxFreeSheet => ({
  kind: "free",
  name: "Rekap 'Uji'",
  columns: [{ width: 5 }, { width: 20 }, { width: 12.346 }],
  rows: [
    { height: 30, cells: [{ value: "KOP & JUDUL", style: { bold: true, fontName: "Arial", fontSize: 15, horizontal: "center" } }] },
    { height: 4, cells: [{ value: "", style: { borderBottom: "double" } }] },
    {
      cells: [
        { value: "No", style: { bold: true, border: "thin", fill: "DCE6F0", wrap: true } },
        { value: "Nama", style: { bold: true, border: "thin", fill: "DCE6F0", wrap: true } },
        { value: 3, style: { border: "thin" } },
      ],
    },
  ],
  merges: ["A1:C1", "A2:C2", "Z"],
  ...ubah,
});

describe("lembar bebas", () => {
  it("buku kerja campuran: lembar lama tetap bergaya 1 dan 2, gaya lama tetap di nomor 0-2", () => {
    const b = createXlsxWorkbook([LAMA, BEBAS()]);
    expect(teks(b, "xl/worksheets/sheet1.xml")).toContain('<c r="A1" s="1" t="inlineStr">');
    const gaya = teks(b, "xl/styles.xml");
    const xf = gaya.split("<cellXfs")[1];
    const lama = GAYA_LAMA.split("<cellXfs")[1].split("</cellXfs>")[0].replace(/^ count="3">/, "");
    expect(xf).toContain(lama);
    expect(gaya).toContain('<name val="Arial"/>');
    // Gaya yang sama dipakai dua sel -> satu nomor gaya.
    const lembar = teks(b, "xl/worksheets/sheet2.xml");
    const sA3 = /<c r="A3" s="(\d+)"/.exec(lembar)![1];
    const sB3 = /<c r="B3" s="(\d+)"/.exec(lembar)![1];
    expect(sA3).toBe(sB3);
    expect(Number(sA3)).toBeGreaterThanOrEqual(3);
  });

  it("sel yang tertutup gabungan mewarisi gaya jangkarnya - garis ganda selebar rentang", () => {
    const lembar = teks(createXlsxWorkbook([BEBAS()]), "xl/worksheets/sheet1.xml");
    const s = /<c r="A2" s="(\d+)"\/>/.exec(lembar)![1];
    expect(lembar).toContain(`<c r="B2" s="${s}"/>`);
    expect(lembar).toContain(`<c r="C2" s="${s}"/>`);
    expect(lembar).toContain('<mergeCells count="2"><mergeCell ref="A1:C1"/><mergeCell ref="A2:C2"/></mergeCells>');
  });

  it("tinggi baris, lebar kolom, angka, dan teks bersandi", () => {
    const lembar = teks(createXlsxWorkbook([BEBAS()]), "xl/worksheets/sheet1.xml");
    expect(lembar).toContain('<row r="1" ht="30" customHeight="1">');
    expect(lembar).toContain('<col min="3" max="3" width="12.35" customWidth="1"/>');
    expect(lembar).toMatch(/<c r="C3" s="\d+"><v>3<\/v><\/c>/);
    expect(lembar).toContain(">KOP &amp; JUDUL</t>");
  });

  it("pengaturan cetak: mendatar, muat selebar, kertas, margin, kaki, dan baris kepala berulang", () => {
    const b = createXlsxWorkbook([
      BEBAS({
        showGridLines: false,
        pageSetup: {
          orientation: "landscape",
          paper: "F4",
          fitToWidth: true,
          horizontalCentered: true,
          marginsCm: { left: 2.54, right: 1.27, top: 1.3, bottom: 1.6 },
          printTitleRows: { from: 3, to: 3 },
          footer: "&LNur & Andi&RHalaman &P dari &N",
        },
      }),
    ]);
    const lembar = teks(b, "xl/worksheets/sheet1.xml");
    expect(lembar).toContain('<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>');
    expect(lembar).toContain('<sheetView workbookViewId="0" showGridLines="0"/>');
    expect(lembar).toContain('<printOptions horizontalCentered="1"/>');
    expect(lembar).toContain('<pageMargins left="1" right="0.5" top="0.512" bottom="0.63" header="0.3" footer="0.3"/>');
    expect(lembar).toContain('<pageSetup paperSize="14" orientation="landscape" fitToWidth="1" fitToHeight="0"/>');
    expect(lembar).toContain("<oddFooter>&amp;LNur &amp; Andi&amp;RHalaman &amp;P dari &amp;N</oddFooter>");
    const buku = uraiXml(teks(b, "xl/workbook.xml"));
    const nama = buku.getElementsByTagName("definedName")[0];
    expect(nama.getAttribute("name")).toBe("_xlnm.Print_Titles");
    expect(nama.getAttribute("localSheetId")).toBe("0");
    // Petik tunggal di nama lembar digandakan - aturan rujukan Excel.
    expect(nama.textContent).toBe("'Rekap ''Uji'''!$3:$3");
    // Urutan unsur lembar menurut skema: sheetPr ... mergeCells, printOptions, pageMargins, pageSetup, headerFooter.
    const urutan = ["<sheetPr>", "<dimension", "<sheetViews>", "<sheetFormatPr", "<cols>", "<sheetData>", "<mergeCells", "<printOptions", "<pageMargins", "<pageSetup", "<headerFooter>"];
    const letak = urutan.map((u) => lembar.indexOf(u));
    expect(letak.every((x) => x >= 0)).toBe(true);
    expect([...letak].sort((a, c) => a - c)).toEqual(letak);
    const kertas = (p: "A4" | "Letter") =>
      teks(createXlsxWorkbook([BEBAS({ pageSetup: { paper: p } })]), "xl/worksheets/sheet1.xml");
    expect(kertas("A4")).toContain('<pageSetup paperSize="9" orientation="portrait"/>');
    expect(kertas("Letter")).toContain('paperSize="1"');
    expect(kertas("A4")).not.toContain("<sheetPr>");
  });

  it("gambar: bagian gambar, relasi, jenis isi - gambar yang sama di dua lembar disimpan sekali", () => {
    const gambar = [{ data: LOGO, row: 0, column: 0, widthPt: 45.5, heightPt: 58, offsetXPt: 2, offsetYPt: 2, description: "Logo & lambang" }];
    const b = createXlsxWorkbook([BEBAS({ images: gambar }), LAMA, BEBAS({ name: "Kedua", images: gambar })]);
    const isi = bacaZip(b);
    for (const [nama, data] of isi) if (/\.(xml|rels)$/.test(nama)) expect(() => uraiXml(data.toString("utf8")), nama).not.toThrow();
    expect([...isi.keys()].filter((k) => k.startsWith("xl/media/"))).toEqual(["xl/media/image1.png"]);
    expect(isi.get("xl/media/image1.png")!.equals(LOGO)).toBe(true);
    expect(isi.has("xl/drawings/drawing1.xml")).toBe(true);
    expect(isi.has("xl/drawings/drawing2.xml")).toBe(true);
    expect(teks(b, "xl/worksheets/_rels/sheet1.xml.rels")).toContain('Target="../drawings/drawing1.xml"');
    expect(teks(b, "xl/worksheets/_rels/sheet3.xml.rels")).toContain('Target="../drawings/drawing2.xml"');
    expect(isi.has("xl/worksheets/_rels/sheet2.xml.rels")).toBe(false);
    expect(teks(b, "xl/drawings/_rels/drawing2.xml.rels")).toContain('Target="../media/image1.png"');
    const gambar1 = teks(b, "xl/drawings/drawing1.xml");
    expect(gambar1).toContain(`<xdr:ext cx="${Math.round(45.5 * 12700)}" cy="${58 * 12700}"/>`);
    expect(gambar1).toContain('descr="Logo &amp; lambang"');
    const jenis = teks(b, "[Content_Types].xml");
    expect(jenis).toContain('<Default Extension="png" ContentType="image/png"/>');
    expect(jenis).toContain('<Override PartName="/xl/drawings/drawing2.xml"');
    expect(teks(b, "xl/worksheets/sheet1.xml")).toContain('<drawing r:id="rId1"/></worksheet>');
    expect(teks(b, "xl/worksheets/sheet2.xml")).not.toContain("<drawing");
  });

  it("pembantu alamat sel", () => {
    expect(xlsxColumnName(0)).toBe("A");
    expect(xlsxColumnName(25)).toBe("Z");
    expect(xlsxColumnName(26)).toBe("AA");
    expect(xlsxCellRef(0, 0)).toBe("A1");
    expect(xlsxRangeRef(4, 1, 4, 27)).toBe("B5:AB5");
  });
});
