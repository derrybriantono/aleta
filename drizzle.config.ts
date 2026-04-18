import { defineConfig } from "drizzle-kit";

const connectionString =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:54329/aleta";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/drizzle-schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: connectionString,
  },
  verbose: true,
  strict: true,
});
