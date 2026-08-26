import { describe, expect, it } from "vitest";

import { normalizeIndonesianWhatsappInput } from "@/components/portal/aleta-bot-manual-send";

describe("normalizeIndonesianWhatsappInput", () => {
  it("normalizes numbers starting with 0 to 62", () => {
    const result = normalizeIndonesianWhatsappInput("085241987654");
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe("6285241987654");
  });

  it("keeps numbers already starting with 62", () => {
    const result = normalizeIndonesianWhatsappInput("6285241987654");
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe("6285241987654");
  });

  it("strips the plus sign from +62 numbers", () => {
    const result = normalizeIndonesianWhatsappInput("+6285241987654");
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe("6285241987654");
  });

  it("removes spaces and dashes before normalizing", () => {
    const result = normalizeIndonesianWhatsappInput("+62 852-4198-7654");
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe("6285241987654");
  });

  it("accepts bare local numbers starting with 8", () => {
    const result = normalizeIndonesianWhatsappInput("85241987654");
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe("6285241987654");
  });

  it("rejects empty input", () => {
    const result = normalizeIndonesianWhatsappInput("   ");
    expect(result.valid).toBe(false);
    expect(result.normalized).toBe("");
  });

  it("rejects non-Indonesian or malformed numbers", () => {
    for (const input of ["12345", "62912345678", "007123", "email@contoh.id"]) {
      const result = normalizeIndonesianWhatsappInput(input);
      expect(result.valid, `input ${input} seharusnya invalid`).toBe(false);
    }
  });

  it("rejects numbers that are too long", () => {
    const result = normalizeIndonesianWhatsappInput("628123456789012345");
    expect(result.valid).toBe(false);
  });
});
