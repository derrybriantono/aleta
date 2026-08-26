import { describe, expect, it } from "vitest";

import { personas } from "@/lib/mock-data";
import { authenticateUser } from "@/lib/permissions";

describe("authenticateUser", () => {
  it("authenticates with valid mock credentials", () => {
    const user = authenticateUser("superadmin", "super123", personas);

    expect(user?.roleId).toBe("super-admin");
  });

  it("rejects invalid credentials", () => {
    const user = authenticateUser("superadmin", "wrong-password", personas);

    expect(user).toBeNull();
  });
});
