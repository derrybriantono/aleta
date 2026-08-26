import path from "node:path";

import {
  buildJlfKabulVerstekTemplateDryRunReport,
  formatJlfKabulVerstekTemplateDryRunMarkdown,
} from "../../src/server/modules/judicia/legal-form/legacy-import/jlf-kabul-verstek-template-dry-run";

type Args = {
  templatePath: string;
  generatedPath?: string;
  variableXlsPath: string;
  format: "json" | "markdown";
};

function readArg(flag: string) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function parseArgs(): Args {
  if (process.argv.includes("--import")) {
    throw new Error("Dry-run template Kabul Verstek tidak mendukung --import. Import final harus dibuat terpisah setelah review admin.");
  }

  const templatePath = readArg("--template");
  const variableXlsPath = readArg("--variables");
  if (!templatePath) throw new Error("Wajib isi --template path ke file RTF legacy.");
  if (!variableXlsPath) throw new Error("Wajib isi --variables path ke abt_variabel.xls.");

  return {
    templatePath: path.resolve(templatePath),
    generatedPath: readArg("--generated") ? path.resolve(readArg("--generated")!) : undefined,
    variableXlsPath: path.resolve(variableXlsPath),
    format: readArg("--format") === "markdown" ? "markdown" : "json",
  };
}

async function main() {
  const args = parseArgs();
  const report = await buildJlfKabulVerstekTemplateDryRunReport(args);
  if (args.format === "markdown") {
    console.log(formatJlfKabulVerstekTemplateDryRunMarkdown(report));
    return;
  }
  console.log(JSON.stringify(report, null, 2));
}

void main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Dry-run template Kabul Verstek gagal.",
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});
