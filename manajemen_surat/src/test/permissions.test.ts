import { describe, expect, it } from "vitest";

import { moduleVisibility, personas } from "@/lib/mock-data";
import {
  canUserRegisterLetters,
  canUserForwardToLeadership,
  getAccessibleModules,
  getAccessiblePortalApps,
  getLeadershipRecipients,
  getPendingInbox,
  searchPortal,
} from "@/lib/permissions";

describe("RBAC visibility", () => {
  it("shows admin modules only to admin personas", () => {
    const admin = personas.find((persona) => persona.id === "usr-admin")!;
    const superAdmin = personas.find((persona) => persona.id === "usr-super")!;
    const staff = personas.find((persona) => persona.id === "usr-budi")!;

    const adminModules = getAccessibleModules(admin, moduleVisibility).map((module) => module.id);
    const superAdminModules = getAccessibleModules(superAdmin, moduleVisibility).map((module) => module.id);
    const staffModules = getAccessibleModules(staff, moduleVisibility).map((module) => module.id);

    expect(adminModules).toContain("mapping-user-jabatan");
    expect(adminModules).not.toContain("visibility-role");
    expect(superAdminModules).toContain("visibility-role");
    expect(superAdminModules).toContain("keuangan");
    expect(superAdminModules).toContain("kepegawaian");
    expect(staffModules).not.toContain("mapping-user-jabatan");
    expect(staffModules).not.toContain("visibility-role");
    expect(staffModules).not.toContain("keuangan");
  });

  it("filters portal apps based on role", () => {
    const superAdmin = personas.find((persona) => persona.id === "usr-super")!;
    const staff = personas.find((persona) => persona.id === "usr-budi")!;

    const superAdminApps = getAccessiblePortalApps(superAdmin).map((app) => app.id);
    const staffApps = getAccessiblePortalApps(staff).map((app) => app.id);

    expect(superAdminApps).toContain("manajemen-surat");
    expect(superAdminApps).toContain("e-keuangan");
    expect(superAdminApps).toContain("manajemen-aset");
    expect(staffApps).toContain("manajemen-surat");
    expect(staffApps).not.toContain("e-keuangan");
    expect(staffApps).not.toContain("manajemen-aset");
  });

  it("filters search results by access level", () => {
    const staff = personas.find((persona) => persona.id === "usr-budi")!;
    const admin = personas.find((persona) => persona.id === "usr-admin")!;

    const staffResults = searchPortal("Ahmad", staff);
    const adminResults = searchPortal("Ahmad", admin);

    expect(staffResults.some((item) => item.type === "pengguna")).toBe(false);
    expect(adminResults.some((item) => item.type === "pengguna")).toBe(true);
  });

  it("enables forwarding to leadership only for Kasubag Umum and Staf Umum positions", () => {
    const kasubag = personas.find((persona) => persona.id === "usr-rina")!;
    const staffUmum = personas.find((persona) => persona.id === "usr-dina")!;
    const staffPelaksana = personas.find((persona) => persona.id === "usr-budi")!;

    expect(canUserForwardToLeadership(kasubag)).toBe(true);
    expect(canUserForwardToLeadership(staffUmum)).toBe(true);
    expect(canUserForwardToLeadership(staffPelaksana)).toBe(false);
  });

  it("allows letter registration only for Kasubag Umum and Staf Umum", () => {
    const kasubag = personas.find((persona) => persona.id === "usr-rina")!;
    const staffUmum = personas.find((persona) => persona.id === "usr-dina")!;
    const ketua = personas.find((persona) => persona.id === "usr-ketua")!;

    expect(canUserRegisterLetters(kasubag)).toBe(true);
    expect(canUserRegisterLetters(staffUmum)).toBe(true);
    expect(canUserRegisterLetters(ketua)).toBe(false);
  });

  it("applies acting assignments to inbox access and leadership lookup", () => {
    const actingSekretaris = {
      ...personas.find((persona) => persona.id === "usr-sekretaris")!,
      actingAssignment: {
        type: "PLT" as const,
        roleId: "ketua" as const,
        positionId: "pos-ketua",
      },
    };
    const users = personas.map((persona) => (persona.id === actingSekretaris.id ? actingSekretaris : persona));

    expect(getPendingInbox(actingSekretaris).some((item) => item.id === "dsp-006")).toBe(true);
    expect(getLeadershipRecipients(users).some((user) => user.id === actingSekretaris.id)).toBe(true);
  });
});
