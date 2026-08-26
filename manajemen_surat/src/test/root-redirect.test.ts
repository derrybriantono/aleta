import { afterEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  })
);

const sessionMock = vi.hoisted(() => ({
  session: null as { user?: { id: string } } | null,
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/auth", () => ({
  getAuth: vi.fn(async () => ({
    api: {
      getSession: vi.fn(async () => sessionMock.session),
    },
  })),
}));

import Home from "@/app/page";

describe("root route redirect", () => {
  afterEach(() => {
    redirectMock.mockClear();
    sessionMock.session = null;
  });

  it("sends anonymous users to login", async () => {
    await expect(Home()).rejects.toThrow("REDIRECT:/login");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("sends authenticated users to the portal", async () => {
    sessionMock.session = { user: { id: "user-superadmin" } };

    await expect(Home()).rejects.toThrow("REDIRECT:/portal");
    expect(redirectMock).toHaveBeenCalledWith("/portal");
  });
});
