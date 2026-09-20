import { createAletaDatabase } from "../../src/server/db/client";

async function main() {
  console.log("[skema] ensureAletaSchema saja - migrasi dan semaian dimatikan");
  const mulai = Date.now();
  await createAletaDatabase({ runMigrations: false, seed: false });
  console.log(`[skema] siap dalam ${Math.round((Date.now() - mulai) / 1000)} detik`);
  process.exit(0);
}

main().catch((galat) => {
  console.error("[skema] GAGAL:", galat);
  process.exit(1);
});
