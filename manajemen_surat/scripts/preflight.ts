import { createAletaDatabase } from "../src/server/db/client";
import { runSystemPreflight } from "../src/server/modules/system/preflight";

async function main() {
  const db = await createAletaDatabase({
    runMigrations: false,
  });

  try {
    const report = await runSystemPreflight(db);
    console.log(JSON.stringify(report, null, 2));

    if (report.status === "error") {
      process.exitCode = 1;
    }
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error("[ALETA] Preflight failed.", error);
  process.exit(1);
});
