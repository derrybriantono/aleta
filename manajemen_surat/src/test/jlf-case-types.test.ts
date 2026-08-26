import { describe, expect, it } from "vitest";

import {
  findJlfCaseTypeOption,
  inferJlfCaseNumberCode,
  JLF_CASE_TYPE_GROUPS,
  JLF_CASE_TYPE_OPTIONS,
  jlfCaseTypeMatches,
} from "@/lib/judicia-legal-form-case-types";

describe("JLF case type catalog", () => {
  it("covers major legal form case groups for religious court workflows", () => {
    expect(JLF_CASE_TYPE_GROUPS.map((group) => group.label)).toEqual([
      "Perkawinan - Gugatan",
      "Perkawinan - Permohonan",
      "Anak, Nafkah, dan Perwalian",
      "Kewarisan dan Harta",
      "Ekonomi Syariah",
      "Permohonan dan Administrasi Lain",
      "Eksekusi",
      "Jinayat / Mahkamah Syariyah",
    ]);
    expect(JLF_CASE_TYPE_OPTIONS.length).toBeGreaterThanOrEqual(50);
  });

  it("infers common SIPP number codes from selected case types", () => {
    expect(inferJlfCaseNumberCode("Cerai Gugat")).toBe("Pdt.G");
    expect(inferJlfCaseNumberCode("Gugatan Sederhana Ekonomi Syariah")).toBe("Pdt.GS");
    expect(inferJlfCaseNumberCode("Itsbat Nikah")).toBe("Pdt.P");
    expect(inferJlfCaseNumberCode("Permohonan Eksekusi")).toBe("Pdt.Eks");
    expect(inferJlfCaseNumberCode("Jinayat Khamar")).toBe("Jn");
  });

  it("matches aliases and SIPP wording without requiring exact labels", () => {
    expect(findJlfCaseTypeOption("Isbat Nikah")?.value).toBe("Itsbat Nikah");
    expect(jlfCaseTypeMatches("Hak Asuh Anak", "Hadhanah")).toBe(true);
    expect(jlfCaseTypeMatches("Gugatan Sederhana Ekonomi Syariah", "Gugatan Sederhana")).toBe(true);
  });
});
