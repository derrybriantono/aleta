import { JLF_PERMISSION } from "@/lib/judicia-legal-form-types";
import type { UserPersona } from "@/lib/types";
import type { AletaDatabase } from "@/server/db/client";
import { logAction } from "@/server/modules/judicia/legal-form/jlf-audit-log-service";
import { requireJlfPermission } from "@/server/modules/judicia/legal-form/jlf-permission-service";
import {
  JlfSippProviderRegistry,
  type JlfSippProvider,
  type SippCaseSearchFilters,
  type SippCaseSummary,
} from "@/server/modules/judicia/legal-form/jlf-sipp-readonly-provider";
import { jlfBadRequest, jlfNotFound } from "@/server/modules/judicia/legal-form/jlf-service-errors";

export type JlfCaseSearchInput = {
  query: string;
  mode: "number" | "party";
  year?: string;
  caseType?: string;
  limit?: number;
};

export type JlfCaseDetailBundle = {
  provider: string;
  detail: Awaited<ReturnType<JlfSippProvider["getCaseDetail"]>>;
  parties: unknown[];
  schedule: unknown[];
  lastHearing: unknown | null;
  nextHearing: unknown | null;
  judges: unknown[];
  panitera: unknown[];
  jurusita: unknown[];
  mediator: unknown[];
  decision: Record<string, unknown> | null;
  diagnostics?: {
    warnings: string[];
  };
};

const CASE_SEARCH_MIN_LENGTH = 1;

function normalizeCaseSearchQuery(query: string, label: string) {
  const normalized = query.trim().replace(/\s+/g, " ");
  if (normalized.length < CASE_SEARCH_MIN_LENGTH) jlfBadRequest(`${label} minimal ${CASE_SEARCH_MIN_LENGTH} karakter.`);
  if (normalized.length > 120) jlfBadRequest(`${label} maksimal 120 karakter.`);
  JlfSippProviderRegistry.assertNoRawSql(normalized);
  return normalized;
}

function normalizeLimit(limit: number | undefined) {
  if (!Number.isFinite(limit)) return 20;
  return Math.max(1, Math.min(50, Math.floor(limit ?? 20)));
}

function getPerkaraId(summary: SippCaseSummary | null | undefined) {
  return summary?.perkaraId ? String(summary.perkaraId) : "";
}

function providerErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Operasi bridge SIPP belum berhasil.";
}

async function readOptionalSipp<T>(label: string, loader: Promise<T>, fallback: T, warnings: string[]) {
  try {
    return await loader;
  } catch (error) {
    warnings.push(`${label}: ${providerErrorMessage(error)}`);
    return fallback;
  }
}

export async function searchJlfCases(
  db: AletaDatabase,
  actor: UserPersona,
  input: JlfCaseSearchInput,
  audit?: { ipAddress?: string; userAgent?: string }
) {
  requireJlfPermission(actor, JLF_PERMISSION.CASE_SEARCH);

  const provider = JlfSippProviderRegistry.getProvider();
  const filters: SippCaseSearchFilters = {
    year: input.year?.trim() || undefined,
    caseType: input.caseType?.trim() || undefined,
    limit: normalizeLimit(input.limit),
  };
  const query =
    input.mode === "number"
      ? normalizeCaseSearchQuery(input.query, "Nomor perkara")
      : normalizeCaseSearchQuery(input.query, "Nama pihak");

  const items =
    input.mode === "number"
      ? await provider.searchCasesByNumber(query, filters)
      : await provider.searchCasesByPartyName(query, filters);
  const limitedItems = items.slice(0, filters.limit);

  await logAction(db, {
    userId: actor.id,
    action: "case.search",
    entityType: "jlf_sipp_case",
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
    metadata: {
      provider: provider.key,
      mode: input.mode,
      year: filters.year,
      caseType: filters.caseType,
      resultCount: limitedItems.length,
      providerResultCount: items.length,
    },
  });

  return {
    provider: provider.key,
    items: limitedItems,
    rawSqlEndpoint: false,
  };
}

export async function getJlfCaseDetail(
  db: AletaDatabase,
  actor: UserPersona,
  nomorPerkara: string,
  audit?: { ipAddress?: string; userAgent?: string }
): Promise<JlfCaseDetailBundle> {
  requireJlfPermission(actor, JLF_PERMISSION.CASE_VIEW);

  const provider = JlfSippProviderRegistry.getProvider();
  const normalizedNomorPerkara = normalizeCaseSearchQuery(decodeURIComponent(nomorPerkara), "Nomor perkara");
  const detail = await provider.getCaseDetail({ nomorPerkara: normalizedNomorPerkara });
  if (!detail) {
    await logAction(db, {
      userId: actor.id,
      action: "case.view.miss",
      entityType: "jlf_sipp_case",
      nomorPerkara: normalizedNomorPerkara,
      ipAddress: audit?.ipAddress,
      userAgent: audit?.userAgent,
      metadata: { provider: provider.key },
    });
    jlfNotFound("Perkara SIPP tidak ditemukan atau adapter SIPP belum aktif.");
  }

  const perkaraId = getPerkaraId(detail);
  const caseContext = { nomorPerkara: normalizedNomorPerkara };
  const diagnostics = { warnings: [] as string[] };
  const [parties, schedule, lastHearing, nextHearing, judges, panitera, jurusita, mediator, decision] = perkaraId
    ? await Promise.all([
        readOptionalSipp("Para pihak", provider.getCaseParties(perkaraId), [], diagnostics.warnings),
        readOptionalSipp("Jadwal sidang", provider.getCaseSchedule(perkaraId, caseContext), [], diagnostics.warnings),
        readOptionalSipp("Sidang sebelumnya", provider.getLastHearing(perkaraId, caseContext), null, diagnostics.warnings),
        readOptionalSipp("Sidang berikutnya", provider.getNextHearing(perkaraId, caseContext), null, diagnostics.warnings),
        readOptionalSipp("Majelis hakim", provider.getJudges(perkaraId), [], diagnostics.warnings),
        readOptionalSipp("Panitera pengganti", provider.getPanitera(perkaraId), [], diagnostics.warnings),
        readOptionalSipp("Jurusita", provider.getJurusita(perkaraId), [], diagnostics.warnings),
        readOptionalSipp("Mediator", provider.getMediator(perkaraId), [], diagnostics.warnings),
        readOptionalSipp("Putusan", provider.getDecisionData(perkaraId), null, diagnostics.warnings),
      ])
    : [[], [], null, null, [], [], [], [], null];

  await logAction(db, {
    userId: actor.id,
    action: "case.view",
    entityType: "jlf_sipp_case",
    entityId: perkaraId,
    nomorPerkara: normalizedNomorPerkara,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
    metadata: { provider: provider.key, warningCount: diagnostics.warnings.length },
  });

  return {
    provider: provider.key,
    detail,
    parties,
    schedule,
    lastHearing,
    nextHearing,
    judges,
    panitera,
    jurusita,
    mediator,
    decision,
    diagnostics: diagnostics.warnings.length > 0 ? diagnostics : undefined,
  };
}

export const JlfCaseService = {
  searchCases: searchJlfCases,
  getCaseDetail: getJlfCaseDetail,
};
