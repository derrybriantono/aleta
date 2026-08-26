import {
  enforceReadOnlySqlLimit,
  normalizeAletaSippSql,
  validateReadOnlySql,
} from "@/server/modules/aleta-sipp/aleta-sipp-sql-validator";

export const ALETA_SIPP_DATA_SOURCE_MODE = {
  DEV_SQL_DUMP: "DEV_SQL_DUMP_MODE",
  DEV_LOCAL_SIPP_DB: "DEV_LOCAL_SIPP_DB_MODE",
  PRODUCTION_ALETA_BOT_SIPP_DB: "PRODUCTION_ALETA_BOT_SIPP_DB_MODE",
} as const;

export type AletaSippDataSourceMode =
  (typeof ALETA_SIPP_DATA_SOURCE_MODE)[keyof typeof ALETA_SIPP_DATA_SOURCE_MODE];

type BridgeResponse<T> = {
  ok?: boolean;
  status?: boolean;
  data?: T;
  result?: T;
  error?: string;
  message?: string;
};

export type AletaSippRegisteredQueryExecutionInput = {
  queryKey: string;
  sql: string;
  placeholderValues?: Record<string, unknown>;
  positionalParams?: unknown[];
  options?: {
    limit?: number;
    timeoutMs?: number;
    purpose?: "monitoring" | "assessment" | "schedule" | "read_only";
  };
};

export type AletaSippRegisteredQueryExecutionResult = {
  ok: boolean;
  queryKey: string;
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  datasource: AletaSippDataSourceStatus;
  executionMode: "ALETA_BOT_BRIDGE" | "BLOCKED_DRY_RUN";
  queryHash?: string;
  error?: string;
  blockedReason?: "DATASOURCE_UNAVAILABLE" | "UNSAFE_SQL" | "BRIDGE_ERROR";
};

export type AletaSippDataSourceStatus = {
  mode: AletaSippDataSourceMode;
  label: string;
  readOnly: boolean;
  source: "sql_dump_snapshot" | "local_sipp_test_db" | "aleta_bot_sipp_db";
  productionReady: boolean;
  connectionKey: string;
  bridgeBaseUrl: string;
  bridgeUrlSource:
    | "ALETA_SIPP_BRIDGE_BASE_URL"
    | "JLF_SIPP_BRIDGE_BASE_URL"
    | "ALETA_BOT_BASE_URL"
    | "ALETA_BOT_RUNTIME_URL"
    | "fallback-localhost";
  tokenConfigured: boolean;
  sqlDumpPath: string;
  localDbConfigured: boolean;
  capabilities: {
    metadataImport: boolean;
    runRegisteredQuery: boolean;
    scheduleByDate: boolean;
    assessmentQuery: boolean;
    rawSqlClientEndpoint: false;
  };
  notes: string[];
};

const DEFAULT_ALETA_BOT_RUNTIME_URL = "http://127.0.0.1:3003";
const DEFAULT_SQL_DUMP_PATH = "D:/Download File/backup_structure_data_db_2026-05-24.sql";

function normalizeMode(value: string | undefined): AletaSippDataSourceMode {
  const raw = String(value || "").trim();
  if (raw === ALETA_SIPP_DATA_SOURCE_MODE.DEV_LOCAL_SIPP_DB) return ALETA_SIPP_DATA_SOURCE_MODE.DEV_LOCAL_SIPP_DB;
  if (raw === ALETA_SIPP_DATA_SOURCE_MODE.PRODUCTION_ALETA_BOT_SIPP_DB) return ALETA_SIPP_DATA_SOURCE_MODE.PRODUCTION_ALETA_BOT_SIPP_DB;
  if (raw === ALETA_SIPP_DATA_SOURCE_MODE.DEV_SQL_DUMP) return ALETA_SIPP_DATA_SOURCE_MODE.DEV_SQL_DUMP;
  return process.env.NODE_ENV === "production"
    ? ALETA_SIPP_DATA_SOURCE_MODE.PRODUCTION_ALETA_BOT_SIPP_DB
    : ALETA_SIPP_DATA_SOURCE_MODE.DEV_SQL_DUMP;
}

function getBridgeBaseUrlConfig() {
  const candidates = [
    ["ALETA_SIPP_BRIDGE_BASE_URL", process.env.ALETA_SIPP_BRIDGE_BASE_URL],
    ["JLF_SIPP_BRIDGE_BASE_URL", process.env.JLF_SIPP_BRIDGE_BASE_URL],
    ["ALETA_BOT_BASE_URL", process.env.ALETA_BOT_BASE_URL],
    ["ALETA_BOT_RUNTIME_URL", process.env.ALETA_BOT_RUNTIME_URL],
  ] as const;
  const configured = candidates.find(([, value]) => Boolean(value?.trim()));
  if (configured) {
    return {
      baseUrl: configured[1]!.trim().replace(/\/+$/, ""),
      source: configured[0] as AletaSippDataSourceStatus["bridgeUrlSource"],
      explicit: true,
    };
  }
  return {
    baseUrl: DEFAULT_ALETA_BOT_RUNTIME_URL,
    source: "fallback-localhost" as const,
    explicit: false,
  };
}

function getInternalToken() {
  return (
    process.env.ALETA_SIPP_BRIDGE_TOKEN ||
    process.env.JLF_SIPP_BRIDGE_TOKEN ||
    process.env.ALETA_BOT_INTERNAL_API_TOKEN ||
    process.env.ALETA_BOT_INTERNAL_TOKEN ||
    ""
  );
}

function getTimeoutMs() {
  return Math.max(1000, Math.min(60000, Number(process.env.ALETA_SIPP_DATASOURCE_TIMEOUT_MS || 10000)));
}

function sanitizeLimit(limit: unknown) {
  return Math.max(1, Math.min(1000, Number(limit || 250)));
}

function rowsFromBridgePayload(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null && !Array.isArray(item));
  }
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  for (const key of ["rows", "items", "results"]) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null && !Array.isArray(item));
    }
  }
  const data = record.data;
  if (Array.isArray(data)) {
    return data.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null && !Array.isArray(item));
  }
  if (data && typeof data === "object" && Array.isArray((data as Record<string, unknown>).rows)) {
    return ((data as Record<string, unknown>).rows as unknown[]).filter(
      (item): item is Record<string, unknown> => typeof item === "object" && item !== null && !Array.isArray(item)
    );
  }
  return [];
}

function datasourceHeaders() {
  const headers: Record<string, string> = { "content-type": "application/json" };
  const token = getInternalToken();
  if (token) headers["x-aleta-internal-token"] = token;
  return headers;
}

export function getAletaSippSqlDumpPath() {
  return process.env.ALETA_SIPP_DEV_SQL_DUMP_PATH || DEFAULT_SQL_DUMP_PATH;
}

export function getAletaSippDataSourceStatus(): AletaSippDataSourceStatus {
  const mode = normalizeMode(process.env.ALETA_SIPP_DATA_SOURCE_MODE);
  const bridge = getBridgeBaseUrlConfig();
  const connectionKey = process.env.ALETA_SIPP_ALETA_BOT_CONNECTION_KEY || "sipp_primary";
  const tokenConfigured = Boolean(getInternalToken());
  const localDbConfigured = Boolean(process.env.ALETA_SIPP_LOCAL_SIPP_DATABASE_URL || process.env.ALETA_SIPP_LOCAL_SIPP_DB_NAME);

  if (mode === ALETA_SIPP_DATA_SOURCE_MODE.PRODUCTION_ALETA_BOT_SIPP_DB) {
    return {
      mode,
      label: "Production Aleta Bot SIPP DB",
      readOnly: true,
      source: "aleta_bot_sipp_db",
      productionReady: bridge.explicit && tokenConfigured,
      connectionKey,
      bridgeBaseUrl: bridge.baseUrl,
      bridgeUrlSource: bridge.source,
      tokenConfigured,
      sqlDumpPath: getAletaSippSqlDumpPath(),
      localDbConfigured,
      capabilities: {
        metadataImport: true,
        runRegisteredQuery: true,
        scheduleByDate: true,
        assessmentQuery: true,
        rawSqlClientEndpoint: false,
      },
      notes: [
        "Production memakai koneksi database SIPP yang dikelola ALETA Bot.",
        "Portal tidak menyimpan ulang password database SIPP.",
        "Semua eksekusi query harus datang dari Query Registry dan tetap read-only.",
      ],
    };
  }

  if (mode === ALETA_SIPP_DATA_SOURCE_MODE.DEV_LOCAL_SIPP_DB) {
    return {
      mode,
      label: "Local SIPP Test DB",
      readOnly: true,
      source: "local_sipp_test_db",
      productionReady: false,
      connectionKey,
      bridgeBaseUrl: bridge.baseUrl,
      bridgeUrlSource: bridge.source,
      tokenConfigured,
      sqlDumpPath: getAletaSippSqlDumpPath(),
      localDbConfigured,
      capabilities: {
        metadataImport: localDbConfigured,
        runRegisteredQuery: localDbConfigured,
        scheduleByDate: localDbConfigured,
        assessmentQuery: localDbConfigured,
        rawSqlClientEndpoint: false,
      },
      notes: [
        "Mode ini untuk laptop/local development setelah dump SIPP di-import ke database testing lokal.",
        "Belum menjadi sumber production.",
      ],
    };
  }

  return {
    mode,
    label: "SQL Dump Snapshot",
    readOnly: true,
    source: "sql_dump_snapshot",
    productionReady: false,
    connectionKey,
    bridgeBaseUrl: bridge.baseUrl,
    bridgeUrlSource: bridge.source,
    tokenConfigured,
    sqlDumpPath: getAletaSippSqlDumpPath(),
    localDbConfigured,
    capabilities: {
      metadataImport: true,
      runRegisteredQuery: false,
      scheduleByDate: false,
      assessmentQuery: false,
      rawSqlClientEndpoint: false,
    },
    notes: [
      "SQL dump hanya snapshot local/testing, bukan sumber data production.",
      "Dump dipakai untuk import metadata, bukan diparse setiap request dashboard.",
    ],
  };
}

export async function callAletaBotSippBridge<T>(
  operation: string,
  params: Record<string, unknown> = {},
  options: { timeoutMs?: number } = {}
) {
  const bridge = getBridgeBaseUrlConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? getTimeoutMs());

  try {
    const response = await fetch(`${bridge.baseUrl}/internal/aleta-bot/jlf/sipp/query`, {
      method: "POST",
      cache: "no-store",
      headers: datasourceHeaders(),
      signal: controller.signal,
      body: JSON.stringify({ operation, params }),
    });
    const payload = (await response.json().catch(() => null)) as BridgeResponse<T> | null;
    if (!response.ok || payload?.ok === false) {
      return {
        ok: false,
        error: payload?.error ?? payload?.message ?? `HTTP ${response.status}`,
        bridge,
      };
    }
    return { ok: true, data: payload?.data as T, bridge };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "ALETA Bot bridge tidak merespons.",
      bridge,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export const AletaBotSippDataSource = {
  async testConnection() {
    return testAletaBotSippDataSource();
  },

  isReadOnlyQuery(sql: string) {
    return validateReadOnlySql(sql).ok;
  },

  enforceTimeoutAndLimit(sql: string, options: { limit?: number; timeoutMs?: number } = {}) {
    const limit = sanitizeLimit(options.limit);
    return { sql: enforceReadOnlySqlLimit(sql, limit), timeoutMs: options.timeoutMs ?? getTimeoutMs(), limit };
  },

  async runRegisteredQuery(input: AletaSippRegisteredQueryExecutionInput): Promise<AletaSippRegisteredQueryExecutionResult> {
    const datasource = getAletaSippDataSourceStatus();
    let executableSql = "";
    let limit = sanitizeLimit(input.options?.limit);
    let timeoutMs = input.options?.timeoutMs ?? getTimeoutMs();

    try {
      const enforced = this.enforceTimeoutAndLimit(input.sql, { limit, timeoutMs });
      executableSql = enforced.sql;
      limit = enforced.limit;
      timeoutMs = enforced.timeoutMs;
    } catch (error) {
      return {
        ok: false,
        queryKey: input.queryKey,
        rows: [],
        rowCount: 0,
        datasource,
        executionMode: "BLOCKED_DRY_RUN",
        blockedReason: "UNSAFE_SQL",
        error: error instanceof Error ? error.message : "Query registry tidak aman.",
      };
    }

    if (!datasource.capabilities.runRegisteredQuery) {
      return {
        ok: false,
        queryKey: input.queryKey,
        rows: [],
        rowCount: 0,
        datasource,
        executionMode: "BLOCKED_DRY_RUN",
        blockedReason: "DATASOURCE_UNAVAILABLE",
        error: "Datasource SIPP belum mendukung eksekusi query registry. Mode SQL dump hanya dipakai metadata/cache, bukan run produksi.",
      };
    }

    const response = await callAletaBotSippBridge<unknown>(
      "legacy.sqlValue",
      {
        queryKey: input.queryKey,
        sql: executableSql,
        placeholderValues: input.placeholderValues ?? {},
        params: input.positionalParams ?? [],
        limit,
        purpose: input.options?.purpose ?? "monitoring",
      },
      { timeoutMs }
    );

    if (!response.ok) {
      return {
        ok: false,
        queryKey: input.queryKey,
        rows: [],
        rowCount: 0,
        datasource,
        executionMode: "ALETA_BOT_BRIDGE",
        blockedReason: "BRIDGE_ERROR",
        error: response.error ?? "ALETA Bot bridge belum dapat menjalankan query registry.",
      };
    }

    const payload = response.data;
    const rows = rowsFromBridgePayload(payload);
    const payloadRecord = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
    return {
      ok: true,
      queryKey: input.queryKey,
      rows,
      rowCount: Number(payloadRecord.rowCount ?? rows.length),
      datasource,
      executionMode: "ALETA_BOT_BRIDGE",
      queryHash: typeof payloadRecord.queryHash === "string" ? payloadRecord.queryHash : undefined,
    };
  },

  async runMonitoringQuery(input: AletaSippRegisteredQueryExecutionInput) {
    return this.runRegisteredQuery({ ...input, options: { ...input.options, purpose: "monitoring" } });
  },

  async runAssessmentQuery(input: AletaSippRegisteredQueryExecutionInput) {
    return this.runRegisteredQuery({ ...input, options: { ...input.options, purpose: "assessment" } });
  },

  async getScheduleByDate(date: string, filters: Record<string, unknown> = {}) {
    return callAletaBotSippBridge("case.scheduleByDate", { date, filters }, { timeoutMs: getTimeoutMs() });
  },
};

export async function testAletaBotSippDataSource() {
  const status = getAletaSippDataSourceStatus();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getTimeoutMs());

  try {
    const response = await fetch(`${status.bridgeBaseUrl}/internal/aleta-bot/db-connections/test`, {
      method: "POST",
      cache: "no-store",
      headers: datasourceHeaders(),
      signal: controller.signal,
      body: JSON.stringify({ connectionKey: status.connectionKey }),
    });
    const payload = (await response.json().catch(() => null)) as BridgeResponse<{
      key?: string;
      status?: "success" | "failed";
      error?: string;
      durationMs?: number;
      source?: string;
      testedAt?: string;
    }> | null;
    const result = payload?.result;
    return {
      ok: response.ok && result?.status === "success",
      mode: status.mode,
      connectionKey: result?.key ?? status.connectionKey,
      bridgeUrlSource: status.bridgeUrlSource,
      tokenConfigured: status.tokenConfigured,
      status: result?.status ?? "failed",
      durationMs: result?.durationMs ?? null,
      source: result?.source ?? "",
      testedAt: result?.testedAt ?? new Date().toISOString(),
      error: result?.error ?? payload?.error ?? payload?.message ?? (response.ok ? "" : `HTTP ${response.status}`),
    };
  } catch (error) {
    return {
      ok: false,
      mode: status.mode,
      connectionKey: status.connectionKey,
      bridgeUrlSource: status.bridgeUrlSource,
      tokenConfigured: status.tokenConfigured,
      status: "failed",
      durationMs: null,
      source: "",
      testedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "ALETA Bot database test tidak merespons.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function assertAletaSippRegisteredReadOnlySql(sql: string) {
  const result = validateReadOnlySql(sql);
  if (!result.ok) {
    throw new Error(result.blockedReason || "Query ALETA x SIPP harus SELECT/read-only.");
  }
}

export { normalizeAletaSippSql };
