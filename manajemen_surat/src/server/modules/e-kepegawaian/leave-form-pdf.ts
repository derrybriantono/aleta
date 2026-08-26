import { readFile } from "node:fs/promises";
import { PDFDocument, PDFName, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";

import {
  type EmployeeProfileDto,
  type HrEmployeeSignatureDto,
  type HrSettingsDto,
  type LeaveApprovalLogDto,
  type LeaveBalanceDto,
  type LeaveRequestDto,
  type LeaveTypeDto,
} from "@/lib/e-kepegawaian-types";
import { type InstitutionIdentity } from "@/lib/types";
import { findStoredHrFile, sanitizeHrDownloadFileName } from "@/server/shared/hr-file-storage";

type FontSet = {
  regular: PDFFont;
  bold: PDFFont;
};

export type LeaveFormPdfData = {
  request: LeaveRequestDto;
  employee: EmployeeProfileDto;
  leaveType: LeaveTypeDto;
  balance: LeaveBalanceDto;
  approvalLogs: LeaveApprovalLogDto[];
  signatures: HrEmployeeSignatureDto[];
  settings?: HrSettingsDto;
};

export type LeaveFormPdfOptions = {
  templateFileName?: string;
  verificationCode?: string;
  verificationUrl?: string;
};

const pageSize: [number, number] = [612, 936];
const pageX = 47;
const pageW = 518;
const black = rgb(0.08, 0.08, 0.08);
const muted = rgb(0.28, 0.28, 0.28);
const lightGray = rgb(0.96, 0.96, 0.96);
const white = rgb(1, 1, 1);

function safeText(value: unknown) {
  return String(value ?? "-")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u00FF]/g, "")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'");
}

function dateLongId(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric" }).format(date);
}

function dateShortId(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function drawText(page: PDFPage, text: unknown, x: number, y: number, size: number, font: PDFFont, color = black) {
  page.drawText(safeText(text), { x, y, size, font, color });
}

function drawCentered(page: PDFPage, text: unknown, x: number, y: number, width: number, size: number, font: PDFFont) {
  const value = safeText(text);
  const offset = Math.max((width - font.widthOfTextAtSize(value, size)) / 2, 2);
  page.drawText(value, { x: x + offset, y, size, font, color: black });
}

function drawLine(page: PDFPage, x1: number, y1: number, x2: number, y2: number) {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.6, color: black });
}

function drawBox(page: PDFPage, x: number, y: number, width: number, height: number, fill = false) {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: fill ? lightGray : undefined,
    borderWidth: 0.6,
    borderColor: black,
  });
}

function erase(page: PDFPage, x: number, y: number, width: number, height: number) {
  page.drawRectangle({ x, y, width, height, color: white });
}

function wrapLines(text: unknown, font: PDFFont, size: number, maxWidth: number) {
  const paragraphs = safeText(text).split(/\n+/);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxWidth || !current) {
        current = next;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines.length ? lines : ["-"];
}

function drawWrapped(page: PDFPage, text: unknown, x: number, y: number, width: number, size: number, font: PDFFont, lineHeight = size + 3, maxLines = 4) {
  wrapLines(text, font, size, width).slice(0, maxLines).forEach((line, index) => {
    drawText(page, line, x, y - index * lineHeight, size, font);
  });
}

function drawCellText(page: PDFPage, text: unknown, x: number, y: number, width: number, height: number, font: PDFFont, size = 8, center = false) {
  if (center) {
    drawCentered(page, text, x, y + (height - size) / 2, width, size, font);
    return;
  }
  drawWrapped(page, text, x + 4, y + height - size - 4, width - 8, size, font, size + 2, Math.max(1, Math.floor((height - 4) / (size + 2))));
}

function drawSection(page: PDFPage, title: string, y: number, fonts: FontSet) {
  drawBox(page, pageX, y, pageW, 17, true);
  drawText(page, title, pageX + 5, y + 5, 8.5, fonts.bold);
}

function drawCells(page: PDFPage, y: number, height: number, cells: Array<{ text: unknown; width: number; bold?: boolean; center?: boolean }>, fonts: FontSet) {
  let cursor = pageX;
  for (const cell of cells) {
    drawBox(page, cursor, y, cell.width, height);
    drawCellText(page, cell.text, cursor, y, cell.width, height, cell.bold ? fonts.bold : fonts.regular, 8, cell.center);
    cursor += cell.width;
  }
}

function leaveMark(leaveTypeCode: string, leaveTypeName: string, code: string, name: string) {
  const normalizedCode = leaveTypeCode.trim().toUpperCase();
  return normalizedCode === code || leaveTypeName.toLowerCase().includes(name.toLowerCase()) ? "V" : "-";
}

async function embedSignatureIfAvailable(pdf: PDFDocument, page: PDFPage, fileName: string, x: number, y: number, width: number, height: number) {
  if (!fileName) return;
  try {
    const stored = await findStoredHrFile(fileName);
    const buffer = await readFile(stored.absolutePath);
    const lower = fileName.toLowerCase();
    const image = lower.endsWith(".png") ? await pdf.embedPng(buffer) : await pdf.embedJpg(buffer);
    const scaled = image.scaleToFit(width, height);
    page.drawImage(image, {
      x: x + (width - scaled.width) / 2,
      y: y + (height - scaled.height) / 2,
      width: scaled.width,
      height: scaled.height,
    });
  } catch {
    // Tanda tangan opsional; PDF tetap bisa dibuat.
  }
}

async function embedQr(pdf: PDFDocument, page: PDFPage, text: string, x: number, y: number, size: number) {
  try {
    const dataUrl = await QRCode.toDataURL(text, { margin: 1, width: 180, errorCorrectionLevel: "M" });
    const base64 = dataUrl.split(",")[1] ?? "";
    const image = await pdf.embedPng(Buffer.from(base64, "base64"));
    page.drawImage(image, { x, y, width: size, height: size });
  } catch {
    // QR adalah lapisan verifikasi tambahan.
  }
}

function signatureFileFor(signatures: HrEmployeeSignatureDto[], employeeId: string | null | undefined, preferredRoles: string[]) {
  if (!employeeId) return "";
  const active = signatures.filter((signature) => signature.employeeId === employeeId && signature.isActive);
  for (const role of preferredRoles) {
    const match = active.find((signature) => signature.signatureRole === role);
    if (match) return match.fileName;
  }
  return active[0]?.fileName ?? "";
}

function deriveValues(data: LeaveFormPdfData, identity: InstitutionIdentity, verificationCode?: string) {
  const { request, employee, leaveType, balance, approvalLogs, signatures } = data;
  const supervisorLog = approvalLogs.find((log) => log.approvalLevel === 1 || log.statusAfter === "waiting_authorized_officer_approval");
  const finalLog = approvalLogs.find((log) => log.statusAfter === "approved") ?? approvalLogs.find((log) => log.approvalLevel > 1);
  const code = verificationCode || `CUTI-${request.id.slice(-6).toUpperCase()}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
  const courtName = identity.courtName || identity.courtShortName || "Pengadilan";
  const cityName = courtName.replace(/^Pengadilan\s+(Tinggi Agama|Tinggi|Agama|Negeri)\s+/i, "").split(/\s+Kelas\s+/i)[0] || "Donggala";
  const finalOfficerId = employee.approvalOfficerEmployeeId || employee.supervisorEmployeeId;
  const leaveCode = leaveType.code.trim().toUpperCase();
  const supervisorRejected = supervisorLog?.action === "reject" || (request.status === "rejected" && !finalLog);

  return {
    supervisorLog,
    finalLog,
    verificationCode: code,
    submittedDate: request.submittedAt ?? request.createdAt,
    courtName,
    cityName,
    officialTitle: employee.approvalOfficerName ? "Pejabat Yang Berwenang" : "Pejabat Yang Berwenang Memberikan Cuti",
    finalOfficerId,
    applicantSignature: signatureFileFor(signatures, employee.id, ["employee"]),
    supervisorSignature: signatureFileFor(signatures, employee.supervisorEmployeeId, ["supervisor", "authorized_officer", "hr_officer"]),
    officialSignature: signatureFileFor(signatures, finalOfficerId, ["authorized_officer", "chairperson", "vice_chairperson", "secretary", "registrar", "hr_officer", "supervisor"]),
    leaveCode,
    supervisorRejected,
    supervisorApproved: Boolean(supervisorLog) && !supervisorRejected,
    balance,
  };
}

async function loadTemplatePdf(fileName?: string) {
  if (!fileName) return null;
  try {
    const stored = await findStoredHrFile(fileName);
    const buffer = await readFile(stored.absolutePath);
    return PDFDocument.load(buffer);
  } catch {
    return null;
  }
}

function flattenPdfForViewer(pdf: PDFDocument) {
  try {
    pdf.getForm().flatten();
  } catch {
    // Template lama bisa saja tidak punya form field. PDF tetap dilanjutkan.
  }

  for (const page of pdf.getPages()) {
    try {
      page.node.delete(PDFName.of("Annots"));
    } catch {
      // Annotation hanya dibersihkan bila ada.
    }
  }
}

function drawTemplateWhiteouts(page: PDFPage) {
  [
    [358, 884, 180, 16], [155, 774, 300, 16],
    [117, 728, 180, 15], [360, 728, 170, 15],
    [117, 711, 175, 15], [360, 711, 150, 15],
    [117, 694, 180, 15], [360, 694, 150, 15],
    [254, 650, 28, 14], [535, 650, 24, 14], [254, 632, 28, 14], [535, 632, 24, 14], [254, 614, 28, 14], [535, 614, 24, 14],
    [51, 586, 508, 20], [117, 552, 100, 14], [325, 552, 95, 14], [455, 552, 95, 14],
    [126, 482, 46, 14], [126, 464, 46, 14], [126, 447, 46, 14], [438, 482, 110, 14], [438, 464, 110, 14], [438, 447, 110, 14],
    [52, 391, 245, 32], [354, 388, 85, 27], [405, 353, 150, 65],
    [52, 296, 260, 20], [405, 229, 150, 80],
    [52, 163, 260, 20], [405, 88, 150, 82],
  ].forEach(([x, y, width, height]) => erase(page, x, y, width, height));
}

async function drawDynamicValues(pdf: PDFDocument, page: PDFPage, data: LeaveFormPdfData, identity: InstitutionIdentity, fonts: FontSet, verificationUrl: string, templateMode: boolean, verificationCode?: string) {
  const { request, employee, leaveType } = data;
  const values = deriveValues(data, identity, verificationCode);
  const balance = values.balance;
  const leaveRows = [
    ["CT", "Cuti Tahunan", 254, 652], ["CB", "Cuti Besar", 535, 652],
    ["CS", "Cuti Sakit", 254, 634], ["CM", "Cuti Melahirkan", 535, 634],
    ["CAP", "Cuti Alasan Penting", 254, 616], ["CLTN", "Cuti di Luar Tanggungan Negara", 535, 616],
  ] as const;

  if (templateMode) {
    drawTemplateWhiteouts(page);
  }

  drawText(page, `${values.cityName}, ${dateShortId(values.submittedDate)}`, 362, 889, 9, fonts.regular);
  drawCentered(page, `Nomor : ${request.requestNumber || request.id}`, pageX, 779, pageW, 9, fonts.regular);

  if (templateMode) {
    drawText(page, employee.fullName, 135, 735, 8, fonts.regular);
    drawText(page, employee.nip || employee.employeeNumber || "-", 382, 735, 8, fonts.regular);
    drawText(page, employee.positionName || "-", 135, 718, 8, fonts.regular);
    drawText(page, employee.rankGrade || "-", 382, 718, 8, fonts.regular);
    drawText(page, employee.unitKerja || values.courtName, 135, 701, 8, fonts.regular);
    drawText(page, "-", 382, 701, 8, fonts.regular);
    leaveRows.forEach(([code, name, x, y]) => drawCentered(page, leaveMark(values.leaveCode, leaveType.name, code, name), x, y, 20, 8, fonts.bold));
    drawWrapped(page, request.reason || "-", 52, 601, 505, 8, fonts.regular, 10, 2);
    drawText(page, `${request.totalDays} hari kerja`, 126, 558, 8, fonts.regular);
    drawText(page, dateLongId(request.startDate), 323, 558, 8, fonts.regular);
    drawText(page, dateLongId(request.endDate), 453, 558, 8, fonts.regular);
    drawCentered(page, balance.balanceN2, 127, 488, 45, 8, fonts.regular);
    drawCentered(page, balance.balanceN1, 127, 470, 45, 8, fonts.regular);
    drawCentered(page, balance.balanceN, 127, 452, 45, 8, fonts.regular);
    drawCentered(page, values.leaveCode === "CS" ? `${request.totalDays} hari` : "-", 438, 488, 110, 8, fonts.regular);
    drawCentered(page, values.leaveCode === "CM" ? `${request.totalDays} hari` : "-", 438, 470, 110, 8, fonts.regular);
    drawCentered(page, ["CAP", "CLTN"].includes(values.leaveCode) ? `${request.totalDays} hari` : "-", 438, 452, 110, 8, fonts.regular);
    drawWrapped(page, request.addressDuringLeave || "-", 55, 419, 240, 8, fonts.regular, 10, 3);
    drawWrapped(page, request.contactDuringLeave || employee.phone || "-", 350, 407, 83, 8, fonts.regular, 10, 2);
    drawCentered(page, employee.fullName, 398, 367, 160, 8, fonts.bold);
    drawCentered(page, `NIP. ${employee.nip || "-"}`, 398, 354, 160, 8, fonts.regular);
    drawCentered(page, values.supervisorApproved ? "V" : "", 72, 327, 80, 8, fonts.bold);
    drawCentered(page, values.supervisorRejected ? "V" : "", 458, 327, 80, 8, fonts.bold);
    drawWrapped(page, values.supervisorLog?.note || "-", 55, 300, 250, 8, fonts.regular, 10, 2);
    drawCentered(page, employee.supervisorName || "-", 398, 238, 160, 8, fonts.bold);
    drawCentered(page, request.status === "approved" ? "V" : "", 72, 196, 80, 8, fonts.bold);
    drawCentered(page, request.status === "rejected" ? "V" : "", 458, 196, 80, 8, fonts.bold);
    drawWrapped(page, values.finalLog?.note || (request.status === "approved" ? "Disetujui melalui E-Kepegawaian ALETA." : "-"), 55, 169, 250, 8, fonts.regular, 10, 2);
    drawCentered(page, employee.approvalOfficerName || "-", 398, 95, 160, 8, fonts.bold);
  }

  if (!templateMode) {
    await drawFallbackTemplate(pdf, page, data, identity, fonts, verificationUrl, values.verificationCode);
    return values.verificationCode;
  }

  await embedSignatureIfAvailable(pdf, page, values.applicantSignature, 415, 376, 115, 28);
  await embedSignatureIfAvailable(pdf, page, values.supervisorSignature, 415, 250, 115, 30);
  await embedSignatureIfAvailable(pdf, page, values.officialSignature, 415, 108, 115, 32);
  await embedQr(pdf, page, verificationUrl, pageX, 38, 42);
  drawText(page, `Kode verifikasi: ${values.verificationCode}`, pageX + 56, 42, 7.2, fonts.regular, muted);

  return values.verificationCode;
}

async function drawFallbackTemplate(pdf: PDFDocument, page: PDFPage, data: LeaveFormPdfData, identity: InstitutionIdentity, fonts: FontSet, verificationUrl: string, verificationCode: string) {
  const { request, employee, leaveType, balance } = data;
  const values = deriveValues(data, identity, verificationCode);
  const leaveCode = values.leaveCode;

  drawText(page, "Kepada", 362, 862, 9, fonts.regular);
  drawText(page, "Yth. Pejabat Yang Berwenang", 362, 848, 9, fonts.regular);
  drawText(page, "Memberikan Cuti", 362, 834, 9, fonts.regular);
  drawText(page, "di Tempat", 362, 820, 9, fonts.regular);
  drawCentered(page, "FORMULIR PERMINTAAN DAN PEMBERIAN CUTI", pageX, 793, pageW, 11, fonts.bold);
  drawSection(page, "I. DATA PEGAWAI", 746, fonts);
  drawCells(page, 728, 18, [
    { text: "Nama", width: 88, bold: true }, { text: employee.fullName, width: 220 },
    { text: "NIP", width: 55, bold: true }, { text: employee.nip || employee.employeeNumber || "-", width: 155 },
  ], fonts);
  drawCells(page, 710, 18, [
    { text: "Jabatan", width: 88, bold: true }, { text: employee.positionName || "-", width: 220 },
    { text: "Gol. Ruang", width: 70, bold: true }, { text: employee.rankGrade || "-", width: 140 },
  ], fonts);
  drawCells(page, 692, 18, [
    { text: "Unit Kerja", width: 88, bold: true }, { text: employee.unitKerja || values.courtName, width: 220 },
    { text: "Masa Kerja", width: 70, bold: true }, { text: "-", width: 140 },
  ], fonts);
  drawSection(page, "II. JENIS CUTI YANG DIAMBIL", 674, fonts);
  [
    ["1. Cuti Tahunan", "CT", "Cuti Tahunan", "2. Cuti Besar", "CB", "Cuti Besar"],
    ["3. Cuti Sakit", "CS", "Cuti Sakit", "4. Cuti Melahirkan", "CM", "Cuti Melahirkan"],
    ["5. Cuti Karena Alasan Penting", "CAP", "Cuti Alasan Penting", "6. Cuti di Luar Tanggungan Negara", "CLTN", "Cuti di Luar Tanggungan Negara"],
  ].forEach((row, index) => {
    drawCells(page, 656 - index * 18, 18, [
      { text: row[0], width: 205 }, { text: leaveMark(leaveCode, leaveType.name, row[1], row[2]), width: 38, center: true, bold: true },
      { text: row[3], width: 225 }, { text: leaveMark(leaveCode, leaveType.name, row[4], row[5]), width: 50, center: true, bold: true },
    ], fonts);
  });
  drawSection(page, "III. ALASAN CUTI", 608, fonts);
  drawBox(page, pageX, 581, pageW, 27);
  drawWrapped(page, request.reason || "-", pageX + 5, 598, pageW - 10, 8, fonts.regular, 10, 2);
  drawSection(page, "IV. LAMANYA CUTI", 562, fonts);
  drawCells(page, 544, 18, [
    { text: "Selama", width: 70, bold: true }, { text: `${request.totalDays} hari kerja`, width: 105 },
    { text: "Mulai tanggal", width: 95, bold: true }, { text: dateLongId(request.startDate), width: 115 },
    { text: "s.d.", width: 35, center: true, bold: true }, { text: dateLongId(request.endDate), width: 98 },
  ], fonts);
  drawSection(page, "V. CATATAN CUTI", 523, fonts);
  drawCells(page, 487, 18, [
    { text: "N-2", width: 82, center: true }, { text: balance.balanceN2, width: 70, center: true }, { text: "hari", width: 110, center: true },
    { text: "Cuti Sakit", width: 140 }, { text: leaveCode === "CS" ? `${request.totalDays} hari` : "-", width: 116, center: true },
  ], fonts);
  drawCells(page, 469, 18, [
    { text: "N-1", width: 82, center: true }, { text: balance.balanceN1, width: 70, center: true }, { text: "hari", width: 110, center: true },
    { text: "Cuti Melahirkan", width: 140 }, { text: leaveCode === "CM" ? `${request.totalDays} hari` : "-", width: 116, center: true },
  ], fonts);
  drawCells(page, 451, 18, [
    { text: "N", width: 82, center: true }, { text: balance.balanceN, width: 70, center: true }, { text: `Sisa ${balance.availableDays} hari`, width: 110, center: true },
    { text: "Cuti Alasan Penting / CLTN", width: 140 }, { text: ["CAP", "CLTN"].includes(leaveCode) ? `${request.totalDays} hari` : "-", width: 116, center: true },
  ], fonts);
  drawSection(page, "VI. ALAMAT SELAMA MENJALANKAN CUTI", 410, fonts);
  drawBox(page, pageX, 365, 255, 45);
  drawBox(page, pageX + 255, 365, 93, 45);
  drawBox(page, pageX + 348, 365, 170, 45);
  drawWrapped(page, request.addressDuringLeave || "-", pageX + 5, 397, 245, 8, fonts.regular, 10, 3);
  drawText(page, "Telp", pageX + 263, 397, 8, fonts.bold);
  drawWrapped(page, request.contactDuringLeave || employee.phone || "-", pageX + 263, 384, 84, 8, fonts.regular, 10, 2);
  drawCentered(page, "Hormat Saya,", pageX + 348, 398, 170, 8, fonts.regular);
  await embedSignatureIfAvailable(pdf, page, values.applicantSignature, pageX + 370, 374, 126, 26);
  drawCentered(page, employee.fullName, pageX + 348, 373, 170, 8, fonts.bold);
  drawCentered(page, `NIP. ${employee.nip || "-"}`, pageX + 348, 361, 170, 8, fonts.regular);
  drawSection(page, "VII. PERTIMBANGAN ATASAN LANGSUNG", 337, fonts);
  drawCells(page, 319, 18, [
    { text: "DISETUJUI", width: 129.5, bold: true, center: true }, { text: "PERUBAHAN", width: 129.5, bold: true, center: true },
    { text: "DITANGGUHKAN", width: 129.5, bold: true, center: true }, { text: "TIDAK DISETUJUI", width: 129.5, bold: true, center: true },
  ], fonts);
  drawCells(page, 301, 18, [
    { text: values.supervisorApproved ? "V" : "", width: 129.5, bold: true, center: true }, { text: "", width: 129.5, center: true },
    { text: "", width: 129.5, center: true }, { text: values.supervisorRejected ? "V" : "", width: 129.5, bold: true, center: true },
  ], fonts);
  drawBox(page, pageX, 236, 330, 65);
  drawBox(page, pageX + 330, 236, pageW - 330, 65);
  drawWrapped(page, values.supervisorLog?.note || "-", pageX + 8, 287, 312, 8, fonts.regular, 10, 3);
  await embedSignatureIfAvailable(pdf, page, values.supervisorSignature, pageX + 350, 259, 145, 27);
  drawCentered(page, employee.supervisorName || "-", pageX + 330, 249, pageW - 330, 8, fonts.bold);
  drawSection(page, "VIII. KEPUTUSAN PEJABAT YANG BERWENANG MEMBERIKAN CUTI", 204, fonts);
  drawCells(page, 186, 18, [
    { text: "DISETUJUI", width: 129.5, bold: true, center: true }, { text: "PERUBAHAN", width: 129.5, bold: true, center: true },
    { text: "DITANGGUHKAN", width: 129.5, bold: true, center: true }, { text: "TIDAK DISETUJUI", width: 129.5, bold: true, center: true },
  ], fonts);
  drawCells(page, 168, 18, [
    { text: request.status === "approved" ? "V" : "", width: 129.5, bold: true, center: true }, { text: "", width: 129.5, center: true },
    { text: "", width: 129.5, center: true }, { text: request.status === "rejected" ? "V" : "", width: 129.5, bold: true, center: true },
  ], fonts);
  drawBox(page, pageX, 92, 330, 76);
  drawBox(page, pageX + 330, 92, pageW - 330, 76);
  drawWrapped(page, values.finalLog?.note || (request.status === "approved" ? "Disetujui melalui E-Kepegawaian ALETA." : "-"), pageX + 8, 154, 312, 8, fonts.regular, 10, 4);
  await embedSignatureIfAvailable(pdf, page, values.officialSignature, pageX + 350, 121, 145, 30);
  drawCentered(page, employee.approvalOfficerName || "-", pageX + 330, 108, pageW - 330, 8, fonts.bold);
  await embedQr(pdf, page, verificationUrl, pageX, 38, 42);
  drawLine(page, pageX + 52, 55, pageX + pageW, 55);
  drawText(page, `Kode verifikasi: ${verificationCode}`, pageX + 56, 42, 7.2, fonts.regular, muted);
  drawText(page, `Dokumen dibuat otomatis oleh E-Kepegawaian ALETA ${values.courtName}.`, pageX + 56, 31, 7.2, fonts.regular, muted);
}

export function buildLeaveFormPdfFileName(request: LeaveRequestDto) {
  const requestNumber = request.requestNumber || request.id;
  return sanitizeHrDownloadFileName(`formulir-cuti-${requestNumber.replace(/[^a-zA-Z0-9._-]/g, "_")}.pdf`);
}

export async function buildLeaveFormPdf(data: LeaveFormPdfData, identity: InstitutionIdentity, options: LeaveFormPdfOptions = {}) {
  const templatePdf = await loadTemplatePdf(options.templateFileName);
  const pdf = templatePdf ?? await PDFDocument.create();
  const page = templatePdf ? pdf.getPages()[0] : pdf.addPage(pageSize);
  const fonts = {
    regular: await pdf.embedFont(StandardFonts.TimesRoman),
    bold: await pdf.embedFont(StandardFonts.TimesRomanBold),
  };
  const verificationCode = options.verificationCode || `CUTI-${data.request.id.slice(-6).toUpperCase()}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
  const verificationUrl = options.verificationUrl || verificationCode;

  const finalCode = await drawDynamicValues(pdf, page, data, identity, fonts, verificationUrl, Boolean(templatePdf), verificationCode);
  flattenPdfForViewer(pdf);

  return {
    buffer: Buffer.from(await pdf.save({ useObjectStreams: false })),
    verificationCode: finalCode,
    usedTemplate: Boolean(templatePdf),
  };
}
