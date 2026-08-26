import { describe, expect, it } from "vitest";

import { normalizePanelSettings, normalizePublicUrl } from "@/lib/panel-settings";

describe("panel settings normalization", () => {
  it("normalizes public access URLs and keeps method choices explicit", () => {
    expect(normalizePublicUrl("aleta.pa-donggala.go.id")).toBe("https://aleta.pa-donggala.go.id");

    const settings = normalizePanelSettings({
      publicAccess: {
        publicUrl: "aleta.pa-donggala.go.id/",
        method: "cloudflare-tunnel",
        notes: "DNS memakai tunnel.",
      },
    });

    expect(settings.publicAccess).toEqual({
      publicUrl: "https://aleta.pa-donggala.go.id",
      method: "cloudflare-tunnel",
      notes: "DNS memakai tunnel.",
    });
  });
});
