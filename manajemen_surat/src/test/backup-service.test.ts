import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { APP_VERSION } from "@/lib/patch-notes";
import { createApplicationBackup, listApplicationBackupFiles } from "@/server/modules/backups/service";

let tempRoot: string | null = null;

describe("application backup file selection", () => {
  afterEach(async () => {
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
      tempRoot = null;
    }
  });

  it("includes app source while excluding config secrets and runtime data", async () => {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), "aleta-backup-test-"));

    await mkdir(path.join(tempRoot, "src", "app"), { recursive: true });
    await mkdir(path.join(tempRoot, "public", "uploads"), { recursive: true });
    await mkdir(path.join(tempRoot, "public", "vendor"), { recursive: true });
    await mkdir(path.join(tempRoot, "node_modules", "pkg"), { recursive: true });
    await mkdir(path.join(tempRoot, ".next"), { recursive: true });
    await mkdir(path.join(tempRoot, "data"), { recursive: true });

    await writeFile(path.join(tempRoot, "src", "app", "page.tsx"), "export default function Page() { return null; }");
    await writeFile(path.join(tempRoot, "public", "mahkamah-agung-logo.png"), "logo");
    await writeFile(path.join(tempRoot, "public", "vendor", "worker.js"), "worker");
    await writeFile(path.join(tempRoot, "public", "uploads", "logo-instansi.png"), "uploaded");
    await writeFile(path.join(tempRoot, "node_modules", "pkg", "index.js"), "module");
    await writeFile(path.join(tempRoot, ".next", "build-id"), "build");
    await writeFile(path.join(tempRoot, "data", "dev-fallback-db.json"), "{}");
    await writeFile(path.join(tempRoot, ".env.local"), "DATABASE_URL=secret");
    await writeFile(path.join(tempRoot, "package.json"), "{}");

    const files = await listApplicationBackupFiles(tempRoot);

    expect(files).toContain("src/app/page.tsx");
    expect(files).toContain("public/mahkamah-agung-logo.png");
    expect(files).toContain("public/vendor/worker.js");
    expect(files).toContain("package.json");
    expect(files).not.toContain(".env.local");
    expect(files).not.toContain("public/uploads/logo-instansi.png");
    expect(files).not.toContain("node_modules/pkg/index.js");
    expect(files).not.toContain(".next/build-id");
    expect(files).not.toContain("data/dev-fallback-db.json");
  });

  it("marks application backup metadata with the active app version", async () => {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), "aleta-backup-version-test-"));

    await mkdir(path.join(tempRoot, "src"), { recursive: true });
    await writeFile(path.join(tempRoot, "src", "index.ts"), "export const ok = true;");
    await writeFile(path.join(tempRoot, "package.json"), "{}");

    const backup = await createApplicationBackup(tempRoot);

    expect(backup.metadata.appVersion).toBe(APP_VERSION);
    expect(backup.metadata.generatedAt).toBeTruthy();
  });
});
