import { ApiError } from "@/server/shared/errors";

export const EXPORT_ROW_LIMITS = {
  lettersCsv: 1000,
  aletaBotMessagesCsv: 1000,
  whatsappReportXlsx: 5000,
  publicQaReviewCsv: 5000,
  policySkipCsv: 5000,
} as const;

export function exportOverflowLimit(limit: number) {
  return Math.max(1, Math.floor(limit)) + 1;
}

export function assertExportRowLimit(rowCount: number, limit: number, label: string) {
  if (rowCount <= limit) return;

  throw new ApiError(
    413,
    `${label} terlalu besar untuk diexport sekaligus. Maksimal ${limit.toLocaleString("id-ID")} baris. Persempit filter tanggal/status/pencarian, lalu coba export lagi.`,
    {
      rowCount,
      maxRows: limit,
    }
  );
}
