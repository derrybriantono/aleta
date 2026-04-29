const logService = require("./logService");

const blockedKeywords = [
  "insert",
  "update",
  "delete",
  "drop",
  "alter",
  "truncate",
  "create",
  "replace",
  "grant",
  "revoke",
  "exec",
  "execute",
  "call",
];

function normalizeSql(sqlText) {
  return String(sqlText || "").trim();
}

function validateQuery(sqlText, { category = "system", recipientColumn = "", outputColumns = [] } = {}) {
  const sql = normalizeSql(sqlText);
  const lower = sql.toLowerCase();
  const errors = [];
  const warnings = [];

  if (!sql) {
    errors.push("query_empty");
  }

  if (lower.startsWith("legacy:")) {
    return {
      valid: true,
      safeForPreview: false,
      errors,
      warnings: ["legacy_query_reference_not_executable_from_ui"],
      previewSql: "",
    };
  }

  if (!lower.startsWith("select")) {
    errors.push("only_select_allowed");
  }

  for (const keyword of blockedKeywords) {
    if (new RegExp(`\\b${keyword}\\b`, "i").test(sql)) {
      errors.push(`blocked_keyword_${keyword}`);
    }
  }

  const semicolonCount = (sql.match(/;/g) || []).length;
  if (semicolonCount > 0) {
    errors.push("semicolon_or_multiple_statement_detected");
  }

  if (/--|\/\*|\*\//.test(sql)) {
    errors.push("sql_comment_detected");
  }

  if (category === "party" && recipientColumn && Array.isArray(outputColumns) && outputColumns.length > 0) {
    if (!outputColumns.includes(recipientColumn)) {
      errors.push("recipient_column_missing_from_output_columns");
    }
  }

  let previewSql = sql.replace(/\s+limit\s+\d+(\s*,\s*\d+)?\s*$/i, "");
  if (previewSql && errors.length === 0) {
    previewSql = `${previewSql} LIMIT 5`;
  }

  return {
    valid: errors.length === 0,
    safeForPreview: errors.length === 0,
    errors,
    warnings,
    previewSql,
  };
}

async function logQueryValidationFailure(sqlText, result, metadata = {}) {
  if (result.valid) return;
  await logService.logQueryError({
    eventType: "query_validation_failed",
    message: "Validasi query ALETA Bot gagal.",
    metadata: {
      ...metadata,
      errors: result.errors,
      sqlPreview: String(sqlText || "").slice(0, 240),
    },
  });
}

module.exports = {
  validateQuery,
  logQueryValidationFailure,
};
