import { describe, expect, it } from "vitest";

import { getAssignableActingUsers, validateActingAssignmentRequest } from "@/core/organization/service";
import { personas } from "@/lib/mock-data";

describe("organization service", () => {
  it("limits acting assignment candidates to direct subordinates", () => {
    const sekretaris = personas.find((persona) => persona.id === "usr-sekretaris")!;
    const assignees = getAssignableActingUsers(sekretaris, personas).map((user) => user.id);

    expect(assignees).toContain("usr-rina");
    expect(assignees).not.toContain("usr-budi");
    expect(assignees).not.toContain("usr-dina");
  });

  it("requires a direct hierarchy link and date range for PLH", () => {
    const sekretaris = personas.find((persona) => persona.id === "usr-sekretaris")!;
    const kasubag = personas.find((persona) => persona.id === "usr-rina")!;
    const arsiparis = personas.find((persona) => persona.id === "usr-budi")!;

    expect(
      validateActingAssignmentRequest({
        supervisorUser: sekretaris,
        assigneeUser: kasubag,
        actingType: "PLH",
        targetPositionId: "pos-sekretaris",
        startDate: "2026-04-11",
        endDate: "2026-04-18",
      }).valid
    ).toBe(true);

    expect(
      validateActingAssignmentRequest({
        supervisorUser: sekretaris,
        assigneeUser: arsiparis,
        actingType: "PLH",
        targetPositionId: "pos-sekretaris",
        startDate: "2026-04-11",
        endDate: "2026-04-18",
      }).valid
    ).toBe(false);

    expect(
      validateActingAssignmentRequest({
        supervisorUser: sekretaris,
        assigneeUser: kasubag,
        actingType: "PLH",
        targetPositionId: "pos-sekretaris",
      }).valid
    ).toBe(false);
  });
});
