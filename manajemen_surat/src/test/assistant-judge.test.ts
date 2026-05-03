import { describe, expect, it } from "vitest";

import {
  DEFAULT_ASSISTANT_JUDGE_CONFIG,
  canAccessAssistantJudge,
  getVisibleAssistantJudgeLinks,
  normalizeAssistantJudgeConfig,
  validateAssistantJudgeUrl,
} from "@/lib/assistant-judge";

describe("assistant judge configuration", () => {
  it("keeps default AI links available for allowed judicial roles", () => {
    const config = normalizeAssistantJudgeConfig();
    const links = getVisibleAssistantJudgeLinks(config, "hakim", "usr-hakim");

    expect(links.map((link) => link.id)).toEqual(["chatgpt", "gemini", "claude"]);
    expect(canAccessAssistantJudge("hakim", config, "usr-hakim")).toBe(true);
  });

  it("filters inactive links and supports per-user access for custom links", () => {
    const config = normalizeAssistantJudgeConfig({
      ...DEFAULT_ASSISTANT_JUDGE_CONFIG,
      visibleRoles: ["super-admin"],
      links: {
        ...DEFAULT_ASSISTANT_JUDGE_CONFIG.links,
        chatgpt: {
          ...DEFAULT_ASSISTANT_JUDGE_CONFIG.links.chatgpt,
          enabled: false,
        },
        "custom-ai": {
          id: "custom-ai",
          provider: "custom-ai",
          enabled: true,
          label: "Custom AI",
          url: "https://example.com/assistant",
          description: "Asisten AI internal tambahan.",
          sortOrder: 40,
          allowedRoles: [],
          allowedUserIds: ["usr-budi"],
          openInNewTab: true,
        },
      },
    });

    expect(getVisibleAssistantJudgeLinks(config, "hakim", "usr-hakim").map((link) => link.id)).toEqual([
      "gemini",
      "claude",
    ]);
    expect(getVisibleAssistantJudgeLinks(config, "staf", "usr-budi").map((link) => link.id)).toContain("custom-ai");
    expect(canAccessAssistantJudge("staf", config, "usr-budi")).toBe(true);
    expect(canAccessAssistantJudge("staf", config, "usr-unknown")).toBe(false);
  });

  it("rejects unsafe URLs", () => {
    expect(validateAssistantJudgeUrl("javascript:alert(1)").ok).toBe(false);
    expect(validateAssistantJudgeUrl("data:text/html,boom").ok).toBe(false);
    expect(validateAssistantJudgeUrl("https://chatgpt.com/g/example").ok).toBe(true);
  });
});
