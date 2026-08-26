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

function walkSqlOutsideStrings(sql, onOutsideChar) {
  let quote = "";
  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];
    if (quote) {
      if (char === "\\" && quote !== "`") {
        index += 1;
        continue;
      }
      if (char === quote) {
        if (next === quote && quote !== "`") {
          index += 1;
        } else {
          quote = "";
        }
      }
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      continue;
    }
    onOutsideChar(char, index);
  }
}

function stripCommentsOutsideStrings(sql) {
  let output = "";
  let quote = "";
  let removed = false;
  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];
    if (quote) {
      output += char;
      if (char === "\\" && quote !== "`") {
        if (typeof next === "string") {
          output += next;
          index += 1;
        }
        continue;
      }
      if (char === quote) {
        if (next === quote && quote !== "`") {
          output += next;
          index += 1;
        } else {
          quote = "";
        }
      }
      continue;
    }

    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      output += char;
      continue;
    }

    if (char === "-" && next === "-") {
      removed = true;
      while (index < sql.length && sql[index] !== "\n") index += 1;
      output += "\n";
      continue;
    }

    if (char === "#") {
      removed = true;
      while (index < sql.length && sql[index] !== "\n") index += 1;
      output += "\n";
      continue;
    }

    if (char === "/" && next === "*") {
      removed = true;
      index += 2;
      while (index < sql.length && !(sql[index] === "*" && sql[index + 1] === "/")) index += 1;
      if (index < sql.length) index += 1;
      output += " ";
      continue;
    }

    output += char;
  }
  return { sql: output, removed };
}

function findSemicolonsOutsideStrings(sql) {
  const positions = [];
  walkSqlOutsideStrings(sql, (char, index) => {
    if (char === ";") positions.push(index);
  });
  return positions;
}

function stripTrailingSemicolons(sql) {
  let cleaned = sql.trim();
  let removed = false;
  while (cleaned.endsWith(";")) {
    cleaned = cleaned.slice(0, -1).trimEnd();
    removed = true;
  }
  return { sql: cleaned.trim(), removed };
}

function maskStringLiterals(sql) {
  let output = "";
  let quote = "";
  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];
    if (quote) {
      output += " ";
      if (char === "\\" && quote !== "`") {
        if (typeof next === "string") {
          output += " ";
          index += 1;
        }
        continue;
      }
      if (char === quote) {
        if (next === quote && quote !== "`") {
          output += " ";
          index += 1;
        } else {
          quote = "";
        }
      }
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      output += " ";
      continue;
    }
    output += char;
  }
  return output;
}

function normalizeSqlForExecution(sqlText) {
  const warnings = [];
  const commentResult = stripCommentsOutsideStrings(normalizeSql(sqlText));
  if (commentResult.removed) {
    warnings.push("sql_comments_removed_for_runtime");
  }

  const trailingResult = stripTrailingSemicolons(commentResult.sql);
  if (trailingResult.removed) {
    warnings.push("trailing_semicolon_removed_for_runtime");
  }

  return {
    sql: trailingResult.sql,
    warnings,
    hasInnerSemicolon: findSemicolonsOutsideStrings(trailingResult.sql).length > 0,
  };
}

function validateQuery(sqlText, { category = "system", recipientColumn = "", outputColumns = [] } = {}) {
  const rawSql = normalizeSql(sqlText);
  const normalized = normalizeSqlForExecution(rawSql);
  const sql = normalized.sql;
  const keywordScanSql = maskStringLiterals(sql);
  const errors = [];
  const warnings = [...normalized.warnings];

  if (!rawSql || !sql) {
    errors.push("query_empty");
  }

  if (rawSql.toLowerCase().startsWith("legacy:")) {
    return {
      valid: true,
      safeForPreview: false,
      errors,
      warnings: ["legacy_query_reference_not_executable_from_ui"],
      previewSql: "",
      normalizedSql: rawSql,
      executableSql: rawSql,
    };
  }

  if (!/^(select|with)\b/i.test(sql)) {
    errors.push("only_select_allowed");
  }
  if (/^with\b/i.test(sql)) {
    warnings.push("cte_query_allowed_select_only");
  }

  for (const keyword of blockedKeywords) {
    if (new RegExp(`\\b${keyword}\\b`, "i").test(keywordScanSql)) {
      errors.push(`blocked_keyword_${keyword}`);
    }
  }

  if (normalized.hasInnerSemicolon) {
    errors.push("semicolon_or_multiple_statement_detected");
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
    normalizedSql: sql,
    executableSql: sql,
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
  normalizeSqlForExecution,
};
