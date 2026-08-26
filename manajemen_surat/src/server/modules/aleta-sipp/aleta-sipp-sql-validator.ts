export type AletaSippReadOnlySqlStatus =
  | "SAFE_READ_ONLY"
  | "EMPTY_SQL"
  | "COMMENTED_SQL"
  | "UNSAFE_KEYWORD"
  | "MULTI_STATEMENT"
  | "NON_SELECT_STATEMENT"
  | "MISSING_PERIOD_FILTER";

export type AletaSippReadOnlySqlValidation = {
  ok: boolean;
  selectOnly: boolean;
  status: AletaSippReadOnlySqlStatus;
  reason: string;
  blockedReason: string | null;
  normalizedSql: string;
  statementSql: string;
  hasLimit: boolean;
  usesPeriodParameter: boolean;
};

const BLOCKED_SQL_PATTERN =
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|REPLACE|MERGE|GRANT|REVOKE|CALL|EXEC|EXECUTE|LOAD_FILE|INTO\s+OUTFILE|INTO\s+DUMPFILE)\b/i;
const READ_ONLY_SQL_PATTERN = /^\s*(?:SELECT\b|WITH\b[\s\S]+?\bSELECT\b)/i;
const COMMENT_PATTERN = /\/\*[\s\S]*?\*\/|--[^\n\r]*/g;
const PERIOD_PARAMETER_PATTERN =
  /(:date_start|:date_end|:tanggal_mulai|:tanggal_selesai|:period_start|:period_end|\?|@date_start|@date_end|\btanggal_|date_start|date_end|period_start|period_end)/i;

export function normalizeAletaSippSql(sql: string) {
  return String(sql || "")
    .replace(COMMENT_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function maskStringLiterals(sql: string) {
  let result = "";
  let quote: "'" | '"' | "`" | null = null;
  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];
    if (quote) {
      if (char === "\\" && quote !== "`") {
        result += " ";
        index += 1;
        result += " ";
        continue;
      }
      if (char === quote) {
        if (quote === "'" && next === "'") {
          result += " ";
          index += 1;
          result += " ";
          continue;
        }
        quote = null;
      }
      result += " ";
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      result += " ";
      continue;
    }
    result += char;
  }
  return result;
}

function containsUnsafeStatementSeparator(sql: string) {
  const masked = maskStringLiterals(sql);
  const withoutTrailingSemicolon = masked.replace(/;+\s*$/g, "");
  return withoutTrailingSemicolon.includes(";");
}

function commentLooksUnsafe(sql: string) {
  const comments = sql.match(COMMENT_PATTERN) ?? [];
  return comments.some((comment) => BLOCKED_SQL_PATTERN.test(comment) || /;\s*\S/.test(comment));
}

export function validateReadOnlySql(
  sql: string,
  options: { requirePeriodParameter?: boolean } = {}
): AletaSippReadOnlySqlValidation {
  const rawSql = String(sql || "");
  const normalizedSql = normalizeAletaSippSql(rawSql);
  const maskedSql = maskStringLiterals(normalizedSql);
  const hasComment = COMMENT_PATTERN.test(rawSql);
  COMMENT_PATTERN.lastIndex = 0;

  if (!normalizedSql) {
    return {
      ok: false,
      selectOnly: false,
      status: "EMPTY_SQL",
      reason: "SQL kosong.",
      blockedReason: "SQL kosong.",
      normalizedSql,
      statementSql: "",
      hasLimit: false,
      usesPeriodParameter: false,
    };
  }

  if (hasComment && commentLooksUnsafe(rawSql)) {
    return {
      ok: false,
      selectOnly: false,
      status: "COMMENTED_SQL",
      reason: "SQL mengandung komentar yang berpotensi menyembunyikan statement.",
      blockedReason: "SQL mengandung komentar yang berpotensi menyembunyikan statement.",
      normalizedSql,
      statementSql: normalizedSql,
      hasLimit: /\bLIMIT\s+\d+\b/i.test(maskedSql),
      usesPeriodParameter: PERIOD_PARAMETER_PATTERN.test(normalizedSql),
    };
  }

  if (containsUnsafeStatementSeparator(normalizedSql)) {
    return {
      ok: false,
      selectOnly: false,
      status: "MULTI_STATEMENT",
      reason: "SQL harus satu statement read-only; multi-statement ditolak.",
      blockedReason: "SQL harus satu statement read-only; multi-statement ditolak.",
      normalizedSql,
      statementSql: normalizedSql.replace(/;+\s*$/g, ""),
      hasLimit: /\bLIMIT\s+\d+\b/i.test(maskedSql),
      usesPeriodParameter: PERIOD_PARAMETER_PATTERN.test(normalizedSql),
    };
  }

  if (BLOCKED_SQL_PATTERN.test(maskedSql)) {
    return {
      ok: false,
      selectOnly: false,
      status: "UNSAFE_KEYWORD",
      reason: "SQL mengandung keyword write/DDL/procedure yang ditolak.",
      blockedReason: "SQL mengandung keyword write/DDL/procedure yang ditolak.",
      normalizedSql,
      statementSql: normalizedSql.replace(/;+\s*$/g, ""),
      hasLimit: /\bLIMIT\s+\d+\b/i.test(maskedSql),
      usesPeriodParameter: PERIOD_PARAMETER_PATTERN.test(normalizedSql),
    };
  }

  const statementSql = normalizedSql.replace(/;+\s*$/g, "");
  if (!READ_ONLY_SQL_PATTERN.test(statementSql)) {
    return {
      ok: false,
      selectOnly: false,
      status: "NON_SELECT_STATEMENT",
      reason: "SQL harus berupa SELECT atau WITH ... SELECT.",
      blockedReason: "SQL harus berupa SELECT atau WITH ... SELECT.",
      normalizedSql,
      statementSql,
      hasLimit: /\bLIMIT\s+\d+\b/i.test(maskedSql),
      usesPeriodParameter: PERIOD_PARAMETER_PATTERN.test(normalizedSql),
    };
  }

  const usesPeriodParameter = PERIOD_PARAMETER_PATTERN.test(normalizedSql);
  if (options.requirePeriodParameter && !usesPeriodParameter) {
    return {
      ok: false,
      selectOnly: false,
      status: "MISSING_PERIOD_FILTER",
      reason: "Query berbasis periode harus memiliki parameter/filter periode.",
      blockedReason: "Query berbasis periode harus memiliki parameter/filter periode.",
      normalizedSql,
      statementSql,
      hasLimit: /\bLIMIT\s+\d+\b/i.test(maskedSql),
      usesPeriodParameter,
    };
  }

  return {
    ok: true,
    selectOnly: true,
    status: "SAFE_READ_ONLY",
    reason: "SQL lolos validasi satu statement SELECT read-only.",
    blockedReason: null,
    normalizedSql,
    statementSql,
    hasLimit: /\bLIMIT\s+\d+\b/i.test(maskedSql),
    usesPeriodParameter,
  };
}

export function enforceReadOnlySqlLimit(sql: string, limit: number) {
  const validation = validateReadOnlySql(sql);
  if (!validation.ok) {
    throw new Error(validation.blockedReason ?? validation.reason);
  }
  const safeLimit = Math.max(1, Math.min(1000, Number(limit || 250)));
  if (validation.hasLimit) return validation.statementSql;
  return `${validation.statementSql} LIMIT ${safeLimit}`;
}
