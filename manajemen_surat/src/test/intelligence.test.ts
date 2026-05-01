import { describe, expect, it } from "vitest";

import { contextualSearchRegulations } from "@/core/intelligence/aleta-intelligence-service";

describe("ALETA intelligence service", () => {
  it("finds relevant regulations from contextual search", () => {
    const regulations = contextualSearchRegulations({
      moduleId: "manajemen-surat",
      entityType: "surat",
      title: "Permintaan kesiapan audit keamanan aplikasi internal",
      content: "Audit keamanan aplikasi internal, backup, enkripsi, dan penetapan PIC TI.",
      tags: ["Audit", "Keamanan", "TI"],
    });

    expect(regulations.some((entry) => entry.id === "reg-int-002")).toBe(true);
  });
});
