/**
 * PORTAL TIDAK BOLEH MENGINGAT KEGAGALAN MENYALA (20 Oktober 2026)
 *
 * Saat 1.205.16 dipasang, skrip pasang dan portal yang baru menyala menjalankan
 * migrasi 0077 serentak. Satu CREATE TABLE kalah (pg_type_typname_nsp_index),
 * janji getDatabase() gagal - dan janji yang gagal itu disimpan, sehingga tiap
 * permintaan sesudahnya ikut gagal sampai kontainer dimulai ulang (±3 menit).
 *
 * Yang dijaga: sesudah satu kegagalan, panggilan berikutnya mencoba lagi
 * (janji baru), bukan memulangkan kegagalan yang sama.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const asli = { ...process.env };

afterEach(async () => {
  process.env = { ...asli };
  vi.resetModules();
});

describe("getDatabase sesudah gagal menyala", () => {
  it("panggilan berikutnya mencoba lagi, bukan memulangkan kegagalan yang tersimpan", async () => {
    process.env.DATABASE_URL = "postgresql://uji:uji@127.0.0.1:1/uji";
    process.env.ALETA_DISABLE_IN_MEMORY_FALLBACK = "1";
    vi.resetModules();
    const klien = await import("@/server/db/client");

    const pertama = klien.getDatabase();
    await expect(pertama).rejects.toBeTruthy();
    // biarkan penangan .catch pembersih berjalan
    await new Promise((selesai) => setTimeout(selesai, 0));

    const kedua = klien.getDatabase();
    expect(kedua).not.toBe(pertama);
    await expect(kedua).rejects.toBeTruthy();
    await new Promise((selesai) => setTimeout(selesai, 0));
    await klien.closeDatabase().catch(() => undefined);
  }, 30_000);

  it("migrasi yang bertabrakan dengan proses lain dicoba sekali lagi", () => {
    const sumber = readFileSync(path.join(process.cwd(), "src/server/db/client.ts"), "utf8");
    const i = sumber.indexOf("if (options.runMigrations ?? true) {");
    const blok = sumber.slice(i, i + 900);
    expect(blok).toContain("await runDatabaseMigrations(orm);\n    } catch (galat) {");
    expect(blok.match(/await runDatabaseMigrations\(orm\);/g)?.length).toBe(2);
    expect(blok).toContain("if (isRecoverablePostgresBootError(galat)) throw galat;");
  });
});
