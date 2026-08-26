import { afterEach, describe, expect, it, vi } from "vitest";

import { getInstitutionLogoSrc, INSTITUTION_LOGO_RENDER_VERSION } from "@/lib/institution-logo";

describe("institution logo source", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("adds a render-version query to internal stored logo URLs", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/aleta");

    expect(getInstitutionLogoSrc("/api/public/institution/logo/logo.png")).toBe(
      `/aleta/api/public/institution/logo/logo.png?v=${INSTITUTION_LOGO_RENDER_VERSION}`
    );
    expect(getInstitutionLogoSrc("/aleta/api/public/institution/logo/logo.png")).toBe(
      `/aleta/api/public/institution/logo/logo.png?v=${INSTITUTION_LOGO_RENDER_VERSION}`
    );
  });

  it("leaves external logo URLs unchanged", () => {
    expect(getInstitutionLogoSrc("https://example.test/logo.png")).toBe("https://example.test/logo.png");
  });
});
