import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

import { schema } from "../../src/server/db/drizzle-schema";

const connectionString =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:54329/aleta";

async function main() {
  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });

  try {
    await migrate(db, {
      migrationsFolder: "drizzle",
    });
    console.log("[ALETA] Drizzle migrations applied successfully.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[ALETA] Migration failed.", error);
  process.exit(1);
});
