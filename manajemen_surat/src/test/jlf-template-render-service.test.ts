// @vitest-environment node

import { describe, expect, it } from "vitest";

import { buildJlfOutputFileName } from "@/server/modules/judicia/legal-form/documents/jlf-document-generation-service";
import { renderStringTemplate } from "@/server/modules/judicia/legal-form/documents/jlf-template-render-service";

describe("JLF template render service", () => {
  it("resolves equivalent semantic placeholders and keeps RTF line breaks readable", () => {
    const rendered = renderStringTemplate({
      content: "{\\rtf1 Perkara <<nomor.perkara>>\\par #9000#}",
      fileType: "rtf",
      values: [
        { key: "nomor_perkara", placeholder: "{{nomor_perkara}}", value: "310/Pdt.G/2026/PA.Dgl" },
        { key: "narasi", placeholder: "#9000#", value: "Baris pertama<br />Baris kedua" },
      ],
    });

    expect(rendered.renderedText).toContain("310/Pdt.G/2026/PA.Dgl");
    expect(rendered.renderedText).toContain("Baris pertama\\line Baris kedua");
    expect(rendered.unknownPlaceholders).toHaveLength(0);
  });

  it("formats JLF generated document names like ABT output names", () => {
    expect(
      buildJlfOutputFileName(
        "272/Pdt.G/2026/PA.Dgl",
        "[01] [Kabul Verstek] Cerai (Format Lengkap) (RTF)-Gugatan & Permohonan-active",
        "rtf"
      )
    ).toBe("272_Pdt.G_2026_PA.Dgl - [01] [Kabul Verstek] Cerai (Format Lengkap) - by JLF.rtf");
  });
});
