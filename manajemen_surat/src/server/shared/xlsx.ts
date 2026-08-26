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
  creator?: string;
  createdAt?: Date;
};

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

function workbookXml(sheets: XlsxSheet[]) {
  const sheetEntries = sheets
    .map((sheet, index) => `<sheet name="${escapeXml(safeSheetName(sheet.name, index))}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
    .join("");
  return [
    XML_DECLARATION,
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    "<bookViews><workbookView/></bookViews>",
    `<sheets>${sheetEntries}</sheets>`,
    "</workbook>",
  ].join("");
}

function workbookRelsXml(sheets: XlsxSheet[]) {
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

function contentTypesXml(sheets: XlsxSheet[]) {
  const sheetOverrides = sheets
    .map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
    .join("");
  return [
    XML_DECLARATION,
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
    '<Default Extension="xml" ContentType="application/xml"/>',
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>',
    '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>',
    sheetOverrides,
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
  const creator = escapeXml(options.creator || "ALETA");
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

function appXml(sheets: XlsxSheet[]) {
  return [
    XML_DECLARATION,
    '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">',
    "<Application>ALETA</Application>",
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

export function createXlsxWorkbook(sheets: XlsxSheet[], options: XlsxWorkbookOptions = {}) {
  const safeSheets = sheets.length > 0 ? sheets : [{ name: "Data", columns: [{ key: "empty", header: "Data" }], rows: [] }];
  const files: Array<{ name: string; data: Buffer }> = [
    { name: "[Content_Types].xml", data: Buffer.from(contentTypesXml(safeSheets), "utf8") },
    { name: "_rels/.rels", data: Buffer.from(rootRelsXml(), "utf8") },
    { name: "docProps/core.xml", data: Buffer.from(coreXml(options), "utf8") },
    { name: "docProps/app.xml", data: Buffer.from(appXml(safeSheets), "utf8") },
    { name: "xl/workbook.xml", data: Buffer.from(workbookXml(safeSheets), "utf8") },
    { name: "xl/_rels/workbook.xml.rels", data: Buffer.from(workbookRelsXml(safeSheets), "utf8") },
    { name: "xl/styles.xml", data: Buffer.from(stylesXml(), "utf8") },
    ...safeSheets.map((sheet, index) => ({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      data: Buffer.from(worksheetXml(sheet), "utf8"),
    })),
  ];

  return createZip(files);
}
