import { createAletaDatabase } from "../../src/server/db/client";
import { resolveJlfVariableQueryPreview } from "../../src/lib/judicia-legal-form-query-preview";

type VariableRow = {
  id: string;
  legacy_code: string | null;
  key: string;
  label: string;
  source_type: string;
  source_key: string;
  admin_note: string;
};

function readLimit() {
  const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
  const value = Number(limitArg?.split("=")[1] ?? "500");
  if (!Number.isFinite(value) || value < 1) return 500;
  return Math.min(Math.floor(value), 20000);
}

function readOffset() {
  const offsetArg = process.argv.find((arg) => arg.startsWith("--offset="));
  const value = Number(offsetArg?.split("=")[1] ?? "0");
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}

function shouldIncludeOnlySipp() {
  return !process.argv.includes("--all-source-types");
}

async function main() {
  const limit = readLimit();
  const offset = readOffset();
  const sippOnly = shouldIncludeOnlySipp();
  const db = await createAletaDatabase({
    seed: false,
    runMigrations: false,
  });

  try {
    await db.exec("ALTER TABLE jlf_variables ADD COLUMN IF NOT EXISTS sipp_query_preview TEXT NOT NULL DEFAULT ''");
    await db.exec("ALTER TABLE jlf_variables ADD COLUMN IF NOT EXISTS sipp_query_preview_status TEXT NOT NULL DEFAULT 'not_generated'");
    await db.exec("ALTER TABLE jlf_variables ADD COLUMN IF NOT EXISTS sipp_query_preview_key TEXT NOT NULL DEFAULT ''");
    await db.exec("ALTER TABLE jlf_variables ADD COLUMN IF NOT EXISTS sipp_query_preview_generated_at TEXT");

    const rows = await db.prepare(
      `SELECT id, legacy_code, key, label, source_type, source_key, admin_note
       FROM jlf_variables
       ${sippOnly ? "WHERE source_type LIKE 'sipp_%'" : ""}
       ORDER BY
         CASE WHEN legacy_code IS NULL OR legacy_code = '' THEN 1 ELSE 0 END ASC,
         legacy_code ASC,
         key ASC
       LIMIT ?
       OFFSET ?`
    ).all<VariableRow>(limit, offset);

    const now = new Date().toISOString();
    let stored = 0;
    let needsReview = 0;
    let empty = 0;

    for (const row of rows) {
      const preview = resolveJlfVariableQueryPreview({
        sourceType: row.source_type,
        sourceKey: row.source_key,
        key: row.key,
        adminNote: row.admin_note,
      });

      const status = preview.sqlPreview?.includes("needs_review") ? "needs_review" : preview.status;
      if (!preview.sqlPreview) empty += 1;
      if (status === "needs_review") needsReview += 1;

      await db.prepare(
        `UPDATE jlf_variables
         SET sipp_query_preview = ?,
             sipp_query_preview_status = ?,
             sipp_query_preview_key = ?,
             sipp_query_preview_generated_at = ?
         WHERE id = ?`
      ).run(preview.sqlPreview ?? "", status, preview.queryKey ?? "", now, row.id);
      stored += 1;
    }

    console.log(
      JSON.stringify(
        {
          mode: sippOnly ? "sipp_variables_only" : "all_source_types",
          requestedLimit: limit,
          requestedOffset: offset,
          requestedRange: `${offset + 1}-${offset + stored}`,
          updatedRows: stored,
          emptyPreview: empty,
          needsReview,
          generatedAt: now,
          note: "SQL preview tersimpan untuk review admin saja. Query SIPP tetap harus lewat adapter/query registry read-only.",
        },
        null,
        2
      )
    );
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error("[JLF] Gagal menyimpan preview SQL variabel.", error);
  process.exit(1);
});
