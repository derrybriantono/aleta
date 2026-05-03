import { describe, expect, it } from "vitest";

import { APP_VERSION, PATCH_NOTES } from "@/lib/patch-notes";

describe("patch notes", () => {
  it("keeps 0.1.0-beta.7 as the current release without removing older notes", () => {
    expect(APP_VERSION).toBe("0.1.0-beta.7");
    expect(PATCH_NOTES[0]?.version).toBe("0.1.0-beta.7");
    expect(PATCH_NOTES[0]?.title).toContain("Pengiriman WhatsApp Otomatis Aktif");
    expect(PATCH_NOTES[0]?.security).toContain("Broadcast tetap wajib persetujuan.");
    expect(PATCH_NOTES.some((note) => note.version === "0.1.0-beta.6")).toBe(true);
    expect(PATCH_NOTES.some((note) => note.version === "0.1.0-beta.5")).toBe(true);
  });
});
