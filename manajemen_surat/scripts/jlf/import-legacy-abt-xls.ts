import path from "node:path";

import {
  buildJlfLegacyAbtDryRunReport,
  formatJlfLegacyAbtDryRunMarkdown,
  importJlfLegacyAbtSqlVariables,
} from "../../src/server/modules/judicia/legal-form/legacy-import/jlf-legacy-abt-xls-dry-run";
import { createAletaDatabase } from "../../src/server/db/client";

type Args = {
  sourceRoot: string;
  format: "json" | "markdown";
  importSqlVariables: boolean;
};

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const readValue = (flag: string) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
  };

  return {
    sourceRoot: path.resolve(readValue("--source") ?? process.cwd()),
    format: readValue("--format") === "markdown" ? "markdown" : "json",
    importSqlVariables: args.includes("--import-sql-variables") || args.includes("--import"),
  };
}

async function main() {
  const args = parseArgs();
  const report = await buildJlfLegacyAbtDryRunReport(args.sourceRoot);
  if (args.importSqlVariables) {
    const db = await createAletaDatabase({ seed: false, runMigrations: false });
    try {
      const importResult = await importJlfLegacyAbtSqlVariables(db, report);
      const output = { ...report, importExecution: importResult };
      if (args.format === "markdown") {
        console.log(
          formatJlfLegacyAbtDryRunMarkdown(report).replace(
            "Dry-run only. File XLS/CSV ABT hanya dibaca untuk laporan mapping; tidak ada SQL legacy yang dieksekusi dan tidak ada write ke database JLF/SIPP.",
            "Dry-run scan selesai. Mode import SQL dijalankan pada bagian di bawah; SQL legacy tetap tidak dieksekusi ke SIPP dan hanya disimpan sebagai preview needs_review."
          )
        );
        console.log("\n## SQL Variable Import\n");
        console.log(`- Variables read: ${importResult.sqlVariablesRead}`);
        console.log(`- Inserted/updated: ${importResult.insertedOrUpdated}`);
        console.log(`- Legacy codes linked: ${importResult.legacyCodesLinked}`);
        console.log(`- Legacy codes skipped/conflict: ${importResult.legacyCodesSkipped}`);
        for (const warning of importResult.warnings) console.log(`- Warning: ${warning}`);
        return;
      }
      console.log(JSON.stringify(output, null, 2));
      return;
    } finally {
      await db.close();
    }
  }
  if (args.format === "markdown") {
    console.log(formatJlfLegacyAbtDryRunMarkdown(report));
    return;
  }
  console.log(JSON.stringify(report, null, 2));
}

void main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Dry-run importer XLS ABT gagal.",
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});
