import { describe, expect, it } from "vitest";

import {
  applyJlfTransform,
  formatTanggalHijriahIndonesia,
} from "@/server/modules/judicia/legal-form/documents/jlf-transform-service";

describe("JLF transform service", () => {
  it("formats Hijriah dates with the ABT-compatible conversion", () => {
    expect(formatTanggalHijriahIndonesia("2026-05-24")).toBe("7 Zulhijjah 1447");
    expect(applyJlfTransform("2026-05-24", "tanggal_hijriah_needs_review")).toBe("7 Zulhijjah 1447");
  });
});
