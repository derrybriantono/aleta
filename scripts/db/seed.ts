import { createAletaDatabase } from "../../src/server/db/client";

async function main() {
  const db = await createAletaDatabase({
    seed: true,
    runMigrations: false,
  });

  try {
    console.log("[ALETA] Seed completed.");
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error("[ALETA] Seed failed.", error);
  process.exit(1);
});
