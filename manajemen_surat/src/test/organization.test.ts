import { describe, expect, it } from "vitest";

import {
  getActingAssignmentEligibility,
  getAssignableActingUsers,
  getEligibleCandidatesForActingAssignment,
  getPositionById,
  resolveEffectiveRoleId,
  validateActingAssignmentRequest,
} from "@/core/organization/service";
import { personas, positions } from "@/lib/mock-data";
import { type UserPersona } from "@/lib/types";

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
        reason: "Pejabat definitif berhalangan sementara.",
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
        reason: "Pejabat definitif berhalangan sementara.",
      }).valid
    ).toBe(false);

    expect(
      validateActingAssignmentRequest({
        supervisorUser: sekretaris,
        assigneeUser: kasubag,
        actingType: "PLH",
        targetPositionId: "pos-sekretaris",
        reason: "Pejabat definitif berhalangan sementara.",
      }).valid
    ).toBe(false);
  });

  it("allows active Hakim as PLH/PLT candidate for Ketua and Wakil Ketua", () => {
    const ketua = personas.find((persona) => persona.id === "usr-ketua")!;
    const wakil = personas.find((persona) => persona.id === "usr-wakil")!;
    const hakim = personas.find((persona) => persona.id === "usr-hakim")!;

    const ketuaEligibility = getActingAssignmentEligibility(hakim, getPositionById("pos-ketua"), "PLH", {
      supervisorUser: ketua,
    });
    expect(ketuaEligibility.eligible).toBe(true);
    expect(ketuaEligibility.ruleApplied).toBe("court_leadership_judge");

    const wakilEligibility = getActingAssignmentEligibility(hakim, getPositionById("pos-wakil"), "PLT", {
      supervisorUser: wakil,
    });
    expect(wakilEligibility.eligible).toBe(true);
    expect(wakilEligibility.ruleApplied).toBe("court_leadership_judge");
  });

  it("blocks inactive, different-unit, and overlapping Hakim candidates for court leadership", () => {
    const ketua = personas.find((persona) => persona.id === "usr-ketua")!;
    const hakim = personas.find((persona) => persona.id === "usr-hakim")!;
    const targetPosition = getPositionById("pos-ketua");
    const inactiveHakim: UserPersona = { ...hakim, id: "usr-hakim-inactive", isActive: false };
    const differentUnitHakim: UserPersona = { ...hakim, id: "usr-hakim-ti", positionId: "pos-pranata-komputer" };
    const overlappingHakim: UserPersona = {
      ...hakim,
      id: "usr-hakim-overlap",
      actingAssignment: {
        type: "PLH",
        roleId: "wakil-ketua",
        positionId: "pos-wakil",
        startDate: "2026-04-01",
        endDate: "2026-06-01",
      },
    };

    expect(getActingAssignmentEligibility(inactiveHakim, targetPosition, "PLH", { supervisorUser: ketua }).eligible).toBe(false);
    expect(getActingAssignmentEligibility(differentUnitHakim, targetPosition, "PLH", { supervisorUser: ketua }).eligible).toBe(false);
    expect(
      getActingAssignmentEligibility(overlappingHakim, targetPosition, "PLH", {
        supervisorUser: ketua,
        referenceDate: new Date("2026-05-01"),
      }).eligible
    ).toBe(false);
  });

  it("does not make Hakim automatically eligible for non-leadership assignments", () => {
    const panitera = personas.find((persona) => persona.id === "usr-panitera")!;
    const hakim = personas.find((persona) => persona.id === "usr-hakim")!;

    const eligibility = getActingAssignmentEligibility(hakim, getPositionById("pos-panitera"), "PLH", {
      supervisorUser: panitera,
    });

    expect(eligibility.eligible).toBe(false);
  });

  it("validates PLT maximum duration and invalid PLH date order", () => {
    const ketua = personas.find((persona) => persona.id === "usr-ketua")!;
    const hakim = personas.find((persona) => persona.id === "usr-hakim")!;

    expect(
      validateActingAssignmentRequest({
        supervisorUser: ketua,
        assigneeUser: hakim,
        actingType: "PLT",
        targetPositionId: "pos-ketua",
        startDate: "2026-04-01",
        endDate: "2026-07-02",
        reason: "Jabatan kosong sementara.",
      }).valid
    ).toBe(false);

    expect(
      validateActingAssignmentRequest({
        supervisorUser: ketua,
        assigneeUser: hakim,
        actingType: "PLH",
        targetPositionId: "pos-ketua",
        startDate: "2026-04-10",
        endDate: "2026-04-09",
        reason: "Pejabat definitif berhalangan sementara.",
      }).valid
    ).toBe(false);
  });

  it("resolves acting leadership permission only while assignment is active", () => {
    const hakim = personas.find((persona) => persona.id === "usr-hakim")!;
    const actingHakim: UserPersona = {
      ...hakim,
      actingAssignment: {
        type: "PLH",
        roleId: "ketua",
        positionId: "pos-ketua",
        startDate: "2026-04-01",
        endDate: "2026-04-30",
      },
    };

    expect(resolveEffectiveRoleId(actingHakim, new Date("2026-04-15"))).toBe("ketua");
    expect(resolveEffectiveRoleId(actingHakim, new Date("2026-05-01"))).toBe("hakim");
  });

  it("sorts court leadership candidates by court priority before name", () => {
    const ketua = personas.find((persona) => persona.id === "usr-ketua")!;
    const candidates = getEligibleCandidatesForActingAssignment(getPositionById("pos-ketua"), "PLH", {
      userSource: personas,
      positionSource: positions,
      supervisorUser: ketua,
    });

    expect(candidates[0]?.user.id).toBe("usr-wakil");
    expect(candidates.some((item) => item.user.id === "usr-hakim" && item.eligibility.ruleApplied === "court_leadership_judge")).toBe(true);
  });
});
