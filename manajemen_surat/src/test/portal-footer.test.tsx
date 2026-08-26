import { describe, expect, it } from "vitest";

import { buildMapsUrl } from "@/components/layout/portal-footer";

describe("PortalFooter map link", () => {
  it("uses a saved Google Maps URL when available", () => {
    expect(buildMapsUrl("Jl. Vatu Bala", "https://maps.app.goo.gl/contoh")).toBe(
      "https://maps.app.goo.gl/contoh"
    );
  });

  it("turns coordinates into a Google Maps search URL", () => {
    expect(buildMapsUrl("Jl. Vatu Bala", "-0.6821, 119.7429")).toBe(
      "https://www.google.com/maps/search/?api=1&query=-0.6821%2C%20119.7429"
    );
  });

  it("falls back to the written address when map point is empty", () => {
    expect(buildMapsUrl("Jl. Vatu Bala, Donggala", "")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Jl.%20Vatu%20Bala%2C%20Donggala"
    );
  });
});
