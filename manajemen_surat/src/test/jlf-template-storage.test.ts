import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { storeJlfTemplateFile } from "@/server/shared/jlf-template-storage";

const previousUploadDir = process.env.ALETA_UPLOAD_DIR;
let uploadDir: string | undefined;

function uploadableFile(name: string, type: string, content: string) {
  const buffer = Buffer.from(content, "latin1");
  return {
    name,
    type,
    size: buffer.byteLength,
    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  };
}

describe("JLF template storage", () => {
  beforeEach(async () => {
    uploadDir = await mkdtemp(path.join(tmpdir(), "jlf-template-upload-"));
    process.env.ALETA_UPLOAD_DIR = uploadDir;
  });

  afterEach(async () => {
    process.env.ALETA_UPLOAD_DIR = previousUploadDir;
    if (uploadDir) await rm(uploadDir, { recursive: true, force: true });
  });

  it("accepts legacy RTF files reported by browsers as application/msword", async () => {
    const stored = await storeJlfTemplateFile(
      uploadableFile("[01] [Kabul Verstek] Cerai (Format Lengkap).rtf", "application/msword", "{\\rtf1\\ansi #0001#}"),
      { allowedExtensions: ["docx", "rtf"], maxSizeMb: 1 }
    );

    expect(stored.fileType).toBe("rtf");
    expect(stored.originalFileName).toBe("[01] [Kabul Verstek] Cerai (Format Lengkap).rtf");
    expect(stored.storagePath).toContain("jlf/templates/");
  });

  it("rejects files that only pretend to be RTF by extension", async () => {
    await expect(
      storeJlfTemplateFile(
        uploadableFile("putusan-palsu.rtf", "application/msword", "this is not an rtf document"),
        { allowedExtensions: ["docx", "rtf"], maxSizeMb: 1 }
      )
    ).rejects.toMatchObject({ status: 400 });
  });
});
