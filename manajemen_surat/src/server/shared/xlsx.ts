export type XlsxCellValue = string | number | boolean | Date | null | undefined;

export type XlsxColumn = {
  key: string;
  header: string;
  width?: number;
};

export type XlsxSheet = {
  name: string;
  columns: XlsxColumn[];
  rows: Array<Record<string, XlsxCellValue>>;
  autoFilter?: boolean;
  freezeHeader?: boolean;
};

export type XlsxWorkbookOptions = {
  /** dc:creator / lastModifiedBy; bawaan "ALETA". "" = dikosongkan (berkas yang keluar dari ALETA). */
  creator?: string;
  /** docProps/app.xml Application; bawaan "ALETA". "" = dikosongkan. */
  aplikasi?: string;
  createdAt?: Date;
};

// ============================================================================
// LEMBAR BEBAS (2.40.0)
// ============================================================================
//
// XlsxSheet di atas selalu berbentuk "satu baris kepala + baris data" - cukup
// untuk ekspor e-Kepegawaian dan laporan bot. Eviden SKP hakim (27 September
// 2026) menuntut lembar yang dapat DICETAK sebagai dokumen: kop berlogo, sel
// gabung, huruf tebal, garis, tinggi baris, dan pengaturan kertas mendatar.
//
// Lembar bebas ditambahkan DI SAMPING bentuk lama, bukan menggantikannya:
// buku kerja yang hanya berisi XlsxSheet ditulis byte demi byte sama seperti
// sebelumnya (gaya, buku kerja, dan daftar isinya tidak berubah), sehingga
// pemakai lama tidak perlu diuji ulang untuk sesuatu yang tidak mereka minta.

/** Gaya satu sel lembar bebas. Warna "RRGGBB". */
export type XlsxCellStyle = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: number;
  fontName?: string;
  color?: string;
  fill?: string;
  horizontal?: "left" | "center" | "right";
  vertical?: "top" | "center" | "bottom";
  wrap?: boolean;
  /** Garis tipis di keempat sisi. */
  border?: "thin";
  /** Garis bawah saja (menimpa sisi bawah `border`) - "double" untuk garis kop. */
  borderBottom?: "thin" | "medium" | "double";
};

export type XlsxFreeCell = { value: XlsxCellValue; style?: XlsxCellStyle };

export type XlsxFreeRow = {
  /** Tinggi baris dalam titik. Tanpa ini Excel memakai tinggi bawaan. */
  height?: number;
  /** Sel menurut urutan kolom; null/undefined = sel kosong tanpa gaya. */
  cells: Array<XlsxFreeCell | null | undefined>;
};

/** Gambar yang ditambatkan pada satu sel (0-based), ukurannya dalam titik. */
export type XlsxImage = {
  data: Buffer;
  row: number;
  column: number;
  widthPt: number;
  heightPt: number;
  offsetXPt?: number;
  offsetYPt?: number;
  description?: string;
};

export type XlsxPageSetup = {
  orientation?: "portrait" | "landscape";
  /** F4 dicetak sebagai Folio (8,5 x 13 inci = 216 x 330 mm) - kode kertas Excel 14. */
  paper?: "A4" | "F4" | "Letter";
  /** Muat selebar satu halaman; tingginya berlanjut ke halaman berikut. */
  fitToWidth?: boolean;
  marginsCm?: { left: number; right: number; top: number; bottom: number; header?: number; footer?: number };
  /** Baris yang diulang di puncak tiap halaman cetak (1-based, inklusif). */
  printTitleRows?: { from: number; to: number };
  /** Kode kaki halaman Excel apa adanya, mis. "&LJudul&RHalaman &P dari &N". */
  footer?: string;
  horizontalCentered?: boolean;
};

export type XlsxFreeSheet = {
  kind: "free";
  name: string;
  /** Lebar kolom dalam satuan karakter Excel. */
  columns: Array<{ width: number }>;
  rows: XlsxFreeRow[];
  /** Rentang sel gabung, mis. "A1:F1". */
  merges?: string[];
  images?: XlsxImage[];
  pageSetup?: XlsxPageSetup;
  showGridLines?: boolean;
};

export type XlsxAnySheet = XlsxSheet | XlsxFreeSheet;

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

function escapeXml(value: unknown) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function safeSheetName(name: string, index: number) {
  const cleaned = String(name || `Sheet ${index + 1}`)
    .replace(/[:\\/?*\[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 31);
  return cleaned || `Sheet ${index + 1}`;
}

function columnName(index: number) {
  let value = index + 1;
  let label = "";
  while (value > 0) {
    const modulo = (value - 1) % 26;
    label = String.fromCharCode(65 + modulo) + label;
    value = Math.floor((value - modulo) / 26);
  }
  return label;
}

/** Nama kolom Excel dari indeks 0-based: 0 -> "A", 26 -> "AA". */
export function xlsxColumnName(index: number) {
  return columnName(index);
}

/** Alamat sel Excel dari baris dan kolom 0-based: (0, 0) -> "A1". */
export function xlsxCellRef(row: number, column: number) {
  return `${columnName(column)}${row + 1}`;
}

/** Rentang Excel dari dua sudut 0-based: "A1:F1". */
export function xlsxRangeRef(row1: number, column1: number, row2: number, column2: number) {
  return `${xlsxCellRef(row1, column1)}:${xlsxCellRef(row2, column2)}`;
}

function isFreeSheet(sheet: XlsxAnySheet): sheet is XlsxFreeSheet {
  return (sheet as XlsxFreeSheet).kind === "free";
}

function formatCellValue(value: XlsxCellValue) {
  if (value instanceof Date) return value.toISOString();
  return value;
}

function cellXml(reference: string, value: XlsxCellValue, styleId: number) {
  const style = styleId ? ` s="${styleId}"` : "";
  const formatted = formatCellValue(value);

  if (formatted === null || formatted === undefined || formatted === "") {
    return `<c r="${reference}"${style}/>`;
  }

  if (typeof formatted === "number" && Number.isFinite(formatted)) {
    return `<c r="${reference}"${style}><v>${formatted}</v></c>`;
  }

  if (typeof formatted === "boolean") {
    return `<c r="${reference}"${style} t="b"><v>${formatted ? 1 : 0}</v></c>`;
  }

  return `<c r="${reference}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(formatted)}</t></is></c>`;
}

function worksheetXml(sheet: XlsxSheet) {
  const columns = sheet.columns;
  const totalRows = Math.max(1, sheet.rows.length + 1);
  const lastColumn = columnName(Math.max(0, columns.length - 1));
  const dimension = columns.length > 0 ? `A1:${lastColumn}${totalRows}` : "A1";
  const cols = columns
    .map((column, index) => {
      const width = Math.max(8, Math.min(80, Number(column.width || 18)));
      const col = index + 1;
      return `<col min="${col}" max="${col}" width="${width}" customWidth="1"/>`;
    })
    .join("");

  const headerCells = columns
    .map((column, index) => cellXml(`${columnName(index)}1`, column.header, 1))
    .join("");
  const bodyRows = sheet.rows
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 2;
      const cells = columns
        .map((column, columnIndex) => cellXml(`${columnName(columnIndex)}${rowNumber}`, row[column.key], 2))
        .join("");
      return `<row r="${rowNumber}">${cells}</row>`;
    })
    .join("");

  const sheetView = sheet.freezeHeader
    ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
  const autoFilter = sheet.autoFilter !== false && columns.length > 0
    ? `<autoFilter ref="A1:${lastColumn}${totalRows}"/>`
    : "";

  return [
    XML_DECLARATION,
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    `<dimension ref="${dimension}"/>`,
    sheetView,
    `<cols>${cols}</cols>`,
    `<sheetData><row r="1" ht="22" customHeight="1">${headerCells}</row>${bodyRows}</sheetData>`,
    autoFilter,
    "</worksheet>",
  ].join("");
}

// ============================================================================
// Daftar gaya lembar bebas
// ============================================================================
//
// Tiga gaya lama (0 biasa, 1 kepala biru, 2 isi bergaris) SELALU menempati
// nomor 0-2, sehingga lembar lama di buku kerja campuran tetap bergaya sama.
// Gaya lembar bebas ditambahkan sesudahnya menurut urutan pertama dipakai -
// urutan yang tetap, sehingga buku kerja yang sama menghasilkan XML yang sama.

const BASE_FONTS = [
  '<font><sz val="11"/><name val="Calibri"/></font>',
  '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>',
];
const BASE_FILLS = [
  '<fill><patternFill patternType="none"/></fill>',
  '<fill><patternFill patternType="gray125"/></fill>',
  '<fill><patternFill patternType="solid"><fgColor rgb="FF1F4E79"/><bgColor indexed="64"/></patternFill></fill>',
];
const BASE_BORDERS = [
  "<border><left/><right/><top/><bottom/><diagonal/></border>",
  '<border><left style="thin"><color rgb="FFD9E2EC"/></left><right style="thin"><color rgb="FFD9E2EC"/></right><top style="thin"><color rgb="FFD9E2EC"/></top><bottom style="thin"><color rgb="FFD9E2EC"/></bottom><diagonal/></border>',
];
const BASE_XFS = [
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>',
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>',
];

function argb(color: string | undefined, fallback = "") {
  const clean = String(color ?? "").replace(/^#/, "").toUpperCase();
  return /^[0-9A-F]{6}$/.test(clean) ? `FF${clean}` : fallback;
}

class StyleRegistry {
  fonts = [...BASE_FONTS];
  fills = [...BASE_FILLS];
  borders = [...BASE_BORDERS];
  xfs = [...BASE_XFS];
  private cache = new Map<string, number>();

  private indexOf(list: string[], xml: string) {
    const found = list.indexOf(xml);
    if (found >= 0) return found;
    list.push(xml);
    return list.length - 1;
  }

  get isDefault() {
    return this.xfs.length === BASE_XFS.length;
  }

  id(style: XlsxCellStyle | undefined): number {
    if (!style) return 0;
    const key = JSON.stringify(style, Object.keys(style).sort());
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;

    const color = argb(style.color);
    const fontXml =
      "<font>" +
      (style.bold ? "<b/>" : "") +
      (style.italic ? "<i/>" : "") +
      (style.underline ? '<u val="single"/>' : "") +
      `<sz val="${Number(style.fontSize) > 0 ? Number(style.fontSize) : 11}"/>` +
      (color ? `<color rgb="${color}"/>` : "") +
      `<name val="${escapeXml(style.fontName || "Calibri")}"/>` +
      "</font>";
    const fontId = this.indexOf(this.fonts, fontXml);

    const fill = argb(style.fill);
    const fillId = fill
      ? this.indexOf(this.fills, `<fill><patternFill patternType="solid"><fgColor rgb="${fill}"/><bgColor indexed="64"/></patternFill></fill>`)
      : 0;

    const side = (name: string, kind: string | undefined) =>
      kind ? `<${name} style="${kind}"><color rgb="FF000000"/></${name}>` : `<${name}/>`;
    const all = style.border === "thin" ? "thin" : undefined;
    const bottom = style.borderBottom ?? all;
    const borderXml =
      "<border>" + side("left", all) + side("right", all) + side("top", all) + side("bottom", bottom) + "<diagonal/></border>";
    const borderId = all || bottom ? this.indexOf(this.borders, borderXml) : 0;

    const alignment: string[] = [];
    if (style.horizontal) alignment.push(`horizontal="${style.horizontal}"`);
    if (style.vertical) alignment.push(`vertical="${style.vertical}"`);
    if (style.wrap) alignment.push('wrapText="1"');
    const xfXml =
      `<xf numFmtId="0" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0" applyFont="1"` +
      (fillId ? ' applyFill="1"' : "") +
      (borderId ? ' applyBorder="1"' : "") +
      (alignment.length ? ` applyAlignment="1"><alignment ${alignment.join(" ")}/></xf>` : "/>");

    const id = this.indexOf(this.xfs, xfXml);
    this.cache.set(key, id);
    return id;
  }

  xml() {
    return [
      XML_DECLARATION,
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
      `<fonts count="${this.fonts.length}">${this.fonts.join("")}</fonts>`,
      `<fills count="${this.fills.length}">${this.fills.join("")}</fills>`,
      `<borders count="${this.borders.length}">${this.borders.join("")}</borders>`,
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>',
      `<cellXfs count="${this.xfs.length}">${this.xfs.join("")}</cellXfs>`,
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>',
      "</styleSheet>",
    ].join("");
  }
}

// ============================================================================
// Gambar
// ============================================================================

type XlsxMedia = { name: string; data: Buffer; ext: "png" | "jpeg" };

function imageExtension(data: Buffer): "png" | "jpeg" {
  if (data.length >= 8 && data.readUInt32BE(0) === 0x89504e47) return "png";
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "jpeg";
  throw new Error("Gambar XLSX harus PNG atau JPEG.");
}

const EMU_PER_PT = 12700;

function drawingXml(images: XlsxImage[], relIds: string[]) {
  const anchors = images
    .map((image, index) => {
      const id = index + 2;
      const cx = Math.round(image.widthPt * EMU_PER_PT);
      const cy = Math.round(image.heightPt * EMU_PER_PT);
      return (
        "<xdr:oneCellAnchor>" +
        `<xdr:from><xdr:col>${Math.max(0, image.column)}</xdr:col><xdr:colOff>${Math.round((image.offsetXPt ?? 0) * EMU_PER_PT)}</xdr:colOff>` +
        `<xdr:row>${Math.max(0, image.row)}</xdr:row><xdr:rowOff>${Math.round((image.offsetYPt ?? 0) * EMU_PER_PT)}</xdr:rowOff></xdr:from>` +
        `<xdr:ext cx="${cx}" cy="${cy}"/>` +
        "<xdr:pic>" +
        `<xdr:nvPicPr><xdr:cNvPr id="${id}" name="Gambar ${index + 1}" descr="${escapeXml(image.description ?? "Gambar")}"/>` +
        '<xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>' +
        `<xdr:blipFill><a:blip r:embed="${relIds[index]}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>` +
        `<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>` +
        "</xdr:pic><xdr:clientData/></xdr:oneCellAnchor>"
      );
    })
    .join("");
  return [
    XML_DECLARATION,
    '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    anchors,
    "</xdr:wsDr>",
  ].join("");
}

// ============================================================================
// Lembar bebas
// ============================================================================

const PAPER_CODE: Record<string, number> = { A4: 9, F4: 14, Letter: 1 };

function parseRef(ref: string): { row: number; column: number } | null {
  const match = /^([A-Z]{1,3})(\d{1,7})$/.exec(ref.trim().toUpperCase());
  if (!match) return null;
  let column = 0;
  for (const char of match[1]) column = column * 26 + (char.charCodeAt(0) - 64);
  return { row: Number(match[2]) - 1, column: column - 1 };
}

function parseRange(range: string) {
  const [a, b] = String(range).split(":");
  const from = a ? parseRef(a) : null;
  const to = b ? parseRef(b) : from;
  if (!from || !to) return null;
  return {
    top: Math.min(from.row, to.row),
    left: Math.min(from.column, to.column),
    bottom: Math.max(from.row, to.row),
    right: Math.max(from.column, to.column),
  };
}

function footerCode(text: string) {
  return escapeXml(String(text).slice(0, 250));
}

function freeWorksheetXml(sheet: XlsxFreeSheet, registry: StyleRegistry, hasDrawing: boolean) {
  const columnCount = Math.max(1, sheet.columns.length, ...sheet.rows.map((row) => row.cells.length));
  const rowCount = Math.max(1, sheet.rows.length);

  // Sel yang tertutup gabungan diberi gaya sel jangkarnya: garis dan latar
  // rentang gabung digambar Excel dari TIAP selnya sendiri, sehingga tanpa
  // ini garis kotak dan garis ganda kop hanya tampil di sel paling kiri.
  const styleAt = new Map<string, number>();
  const merges = (sheet.merges ?? []).map(parseRange).filter((range): range is NonNullable<typeof range> => Boolean(range));
  for (const range of merges) {
    const anchorStyle = registry.id(sheet.rows[range.top]?.cells[range.left]?.style);
    if (!anchorStyle) continue;
    for (let row = range.top; row <= range.bottom; row += 1) {
      for (let column = range.left; column <= range.right; column += 1) {
        if (row === range.top && column === range.left) continue;
        if (!sheet.rows[row]?.cells[column]) styleAt.set(`${row}:${column}`, anchorStyle);
      }
    }
  }

  const cols = sheet.columns
    .map((column, index) => {
      const width = Math.max(0.5, Math.min(255, Number(column.width) || 8.43));
      return `<col min="${index + 1}" max="${index + 1}" width="${Math.round(width * 100) / 100}" customWidth="1"/>`;
    })
    .join("");

  const rowsXml: string[] = [];
  const lastRow = Math.max(rowCount - 1, ...merges.map((range) => range.bottom));
  for (let rowIndex = 0; rowIndex <= lastRow; rowIndex += 1) {
    const row = sheet.rows[rowIndex];
    const cells: string[] = [];
    for (let column = 0; column < columnCount; column += 1) {
      const cell = row?.cells[column];
      const reference = xlsxCellRef(rowIndex, column);
      if (cell) {
        cells.push(cellXml(reference, cell.value, registry.id(cell.style)));
      } else {
        const inherited = styleAt.get(`${rowIndex}:${column}`);
        if (inherited) cells.push(cellXml(reference, null, inherited));
      }
    }
    const height = row?.height && row.height > 0 ? ` ht="${Math.round(row.height * 100) / 100}" customHeight="1"` : "";
    if (cells.length > 0 || height) rowsXml.push(`<row r="${rowIndex + 1}"${height}>${cells.join("")}</row>`);
  }

  const setup = sheet.pageSetup;
  const fit = Boolean(setup?.fitToWidth);
  const margins = setup?.marginsCm;
  const inch = (cm: number | undefined, fallback: number) =>
    Math.round(((cm ?? fallback * 2.54) / 2.54) * 1000) / 1000;

  const lastColumn = columnName(columnCount - 1);
  return [
    XML_DECLARATION,
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    // Tanpa fitToPage di sheetPr, fitToWidth di pageSetup diabaikan Excel.
    fit ? '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' : "",
    `<dimension ref="A1:${lastColumn}${lastRow + 1}"/>`,
    `<sheetViews><sheetView workbookViewId="0"${sheet.showGridLines === false ? ' showGridLines="0"' : ""}/></sheetViews>`,
    '<sheetFormatPr defaultRowHeight="15"/>',
    cols ? `<cols>${cols}</cols>` : "",
    `<sheetData>${rowsXml.join("")}</sheetData>`,
    merges.length > 0
      ? `<mergeCells count="${merges.length}">${merges
          .map((range) => `<mergeCell ref="${xlsxRangeRef(range.top, range.left, range.bottom, range.right)}"/>`)
          .join("")}</mergeCells>`
      : "",
    setup?.horizontalCentered ? '<printOptions horizontalCentered="1"/>' : "",
    setup
      ? `<pageMargins left="${inch(margins?.left, 0.7)}" right="${inch(margins?.right, 0.7)}" top="${inch(margins?.top, 0.75)}" bottom="${inch(margins?.bottom, 0.75)}" header="${inch(margins?.header, 0.3)}" footer="${inch(margins?.footer, 0.3)}"/>`
      : "",
    setup
      ? `<pageSetup paperSize="${PAPER_CODE[setup.paper ?? "A4"] ?? 9}" orientation="${setup.orientation ?? "portrait"}"${fit ? ' fitToWidth="1" fitToHeight="0"' : ""}/>`
      : "",
    setup?.footer ? `<headerFooter><oddFooter>${footerCode(setup.footer)}</oddFooter></headerFooter>` : "",
    hasDrawing ? '<drawing r:id="rId1"/>' : "",
    "</worksheet>",
  ].join("");
}

function workbookXml(sheets: XlsxAnySheet[]) {
  const sheetEntries = sheets
    .map((sheet, index) => `<sheet name="${escapeXml(safeSheetName(sheet.name, index))}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
    .join("");
  const printTitles = sheets
    .map((sheet, index) => {
      if (!isFreeSheet(sheet) || !sheet.pageSetup?.printTitleRows) return "";
      const { from, to } = sheet.pageSetup.printTitleRows;
      if (!(from >= 1 && to >= from)) return "";
      const name = safeSheetName(sheet.name, index).replace(/'/g, "''");
      return `<definedName name="_xlnm.Print_Titles" localSheetId="${index}">${escapeXml(`'${name}'!$${from}:$${to}`)}</definedName>`;
    })
    .join("");
  return [
    XML_DECLARATION,
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    "<bookViews><workbookView/></bookViews>",
    `<sheets>${sheetEntries}</sheets>`,
    printTitles ? `<definedNames>${printTitles}</definedNames>` : "",
    "</workbook>",
  ].join("");
}

function workbookRelsXml(sheets: XlsxAnySheet[]) {
  const sheetRels = sheets
    .map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`)
    .join("");
  const stylesId = sheets.length + 1;
  return [
    XML_DECLARATION,
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    sheetRels,
    `<Relationship Id="rId${stylesId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`,
    "</Relationships>",
  ].join("");
}

function rootRelsXml() {
  return [
    XML_DECLARATION,
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>',
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>',
    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>',
    "</Relationships>",
  ].join("");
}

function contentTypesXml(sheets: XlsxAnySheet[], drawings: number[] = [], media: XlsxMedia[] = []) {
  const sheetOverrides = sheets
    .map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
    .join("");
  const extensions = new Set(media.map((item) => item.ext));
  return [
    XML_DECLARATION,
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
    '<Default Extension="xml" ContentType="application/xml"/>',
    extensions.has("png") ? '<Default Extension="png" ContentType="image/png"/>' : "",
    extensions.has("jpeg") ? '<Default Extension="jpeg" ContentType="image/jpeg"/>' : "",
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>',
    '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>',
    sheetOverrides,
    drawings
      .map((number) => `<Override PartName="/xl/drawings/drawing${number}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`)
      .join(""),
    "</Types>",
  ].join("");
}

function stylesXml() {
  return [
    XML_DECLARATION,
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>',
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E79"/><bgColor indexed="64"/></patternFill></fill></fills>',
    '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD9E2EC"/></left><right style="thin"><color rgb="FFD9E2EC"/></right><top style="thin"><color rgb="FFD9E2EC"/></top><bottom style="thin"><color rgb="FFD9E2EC"/></bottom><diagonal/></border></borders>',
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>',
    '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs>',
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>',
    "</styleSheet>",
  ].join("");
}

function coreXml(options: XlsxWorkbookOptions) {
  const createdAt = (options.createdAt || new Date()).toISOString();
  const creator = escapeXml(options.creator ?? "ALETA");
  return [
    XML_DECLARATION,
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
    `<dc:creator>${creator}</dc:creator>`,
    `<cp:lastModifiedBy>${creator}</cp:lastModifiedBy>`,
    `<dcterms:created xsi:type="dcterms:W3CDTF">${createdAt}</dcterms:created>`,
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${createdAt}</dcterms:modified>`,
    "</cp:coreProperties>",
  ].join("");
}

function appXml(sheets: XlsxAnySheet[], options: XlsxWorkbookOptions = {}) {
  return [
    XML_DECLARATION,
    '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">',
    `<Application>${escapeXml(options.aplikasi ?? "ALETA")}</Application>`,
    `<Worksheets>${sheets.length}</Worksheets>`,
    "</Properties>",
  ].join("");
}

let crcTable: number[] | null = null;

function getCrcTable() {
  if (crcTable) return crcTable;
  crcTable = Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    return value >>> 0;
  });
  return crcTable;
}

function crc32(buffer: Buffer) {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
}

function createZip(files: Array<{ name: string; data: Buffer }>) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  const now = dosDateTime();
  let offset = 0;

  for (const file of files) {
    const fileName = Buffer.from(file.name, "utf8");
    const data = file.data;
    const crc = crc32(data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(now.dosTime, 10);
    localHeader.writeUInt16LE(now.dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(fileName.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, fileName, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(now.dosTime, 12);
    centralHeader.writeUInt16LE(now.dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(fileName.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, fileName);

    offset += localHeader.length + fileName.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

export function createXlsxWorkbook(sheets: XlsxAnySheet[], options: XlsxWorkbookOptions = {}) {
  const safeSheets: XlsxAnySheet[] =
    sheets.length > 0 ? sheets : [{ name: "Data", columns: [{ key: "empty", header: "Data" }], rows: [] }];

  // Gambar dan gaya lembar bebas dikumpulkan lebih dahulu: keduanya
  // menentukan isi styles.xml dan [Content_Types].xml.
  const registry = new StyleRegistry();
  const media: XlsxMedia[] = [];
  const drawingParts: Array<{ name: string; data: Buffer }> = [];
  const drawingNumbers: number[] = [];
  const sheetParts: Array<{ name: string; data: Buffer }> = [];

  safeSheets.forEach((sheet, index) => {
    const sheetNumber = index + 1;
    if (!isFreeSheet(sheet)) {
      sheetParts.push({ name: `xl/worksheets/sheet${sheetNumber}.xml`, data: Buffer.from(worksheetXml(sheet), "utf8") });
      return;
    }

    const images = sheet.images ?? [];
    const hasDrawing = images.length > 0;
    sheetParts.push({
      name: `xl/worksheets/sheet${sheetNumber}.xml`,
      data: Buffer.from(freeWorksheetXml(sheet, registry, hasDrawing), "utf8"),
    });
    if (!hasDrawing) return;

    const drawingNumber = drawingNumbers.length + 1;
    drawingNumbers.push(drawingNumber);
    const relIds: string[] = [];
    const drawingRels: string[] = [];
    images.forEach((image, imageIndex) => {
      const ext = imageExtension(image.data);
      let item = media.find((existing) => existing.data.equals(image.data));
      if (!item) {
        item = { name: `image${media.length + 1}.${ext}`, data: image.data, ext };
        media.push(item);
      }
      const relId = `rId${imageIndex + 1}`;
      relIds.push(relId);
      drawingRels.push(
        `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${item.name}"/>`
      );
    });
    drawingParts.push(
      { name: `xl/drawings/drawing${drawingNumber}.xml`, data: Buffer.from(drawingXml(images, relIds), "utf8") },
      {
        name: `xl/drawings/_rels/drawing${drawingNumber}.xml.rels`,
        data: Buffer.from(
          [XML_DECLARATION, '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">', ...drawingRels, "</Relationships>"].join(""),
          "utf8"
        ),
      },
      {
        name: `xl/worksheets/_rels/sheet${sheetNumber}.xml.rels`,
        data: Buffer.from(
          [
            XML_DECLARATION,
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
            `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${drawingNumber}.xml"/>`,
            "</Relationships>",
          ].join(""),
          "utf8"
        ),
      }
    );
  });

  const files: Array<{ name: string; data: Buffer }> = [
    { name: "[Content_Types].xml", data: Buffer.from(contentTypesXml(safeSheets, drawingNumbers, media), "utf8") },
    { name: "_rels/.rels", data: Buffer.from(rootRelsXml(), "utf8") },
    { name: "docProps/core.xml", data: Buffer.from(coreXml(options), "utf8") },
    { name: "docProps/app.xml", data: Buffer.from(appXml(safeSheets, options), "utf8") },
    { name: "xl/workbook.xml", data: Buffer.from(workbookXml(safeSheets), "utf8") },
    { name: "xl/_rels/workbook.xml.rels", data: Buffer.from(workbookRelsXml(safeSheets), "utf8") },
    // Buku kerja tanpa gaya bebas memakai styles.xml lama apa adanya.
    { name: "xl/styles.xml", data: Buffer.from(registry.isDefault ? stylesXml() : registry.xml(), "utf8") },
    ...sheetParts,
    ...drawingParts,
    ...media.map((item) => ({ name: `xl/media/${item.name}`, data: item.data })),
  ];

  return createZip(files);
}
