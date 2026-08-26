import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import {
  getEKepegawaianDashboard,
  performEKepegawaianAction,
} from "@/server/modules/e-kepegawaian/service";
import { requireActorUser } from "@/server/modules/organization/service";

describe("E-Kepegawaian service", () => {
  let db: AletaDatabase;

  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true, runMigrations: false });
  });

  afterEach(async () => {
    await db.close();
  });

  it("syncs employee profiles from active ALETA users", async () => {
    const actor = await requireActorUser(db, "usr-super");
    const dashboard = await getEKepegawaianDashboard(db, actor);

    expect(dashboard.currentEmployee?.userId).toBe("usr-super");
    expect(dashboard.employees.some((employee) => employee.userId === "usr-kepeg-staff")).toBe(true);
    expect(dashboard.leaveTypes.some((leaveType) => leaveType.code === "CT")).toBe(true);
  });

  it("submits and approves annual leave with reserved balance", async () => {
    const superAdmin = await requireActorUser(db, "usr-super");
    const initial = await getEKepegawaianDashboard(db, superAdmin);
    const employee = initial.employees.find((item) => item.userId === "usr-kepeg-staff");
    const annualLeave = initial.leaveTypes.find((item) => item.code === "CT");

    expect(employee).toBeTruthy();
    expect(annualLeave).toBeTruthy();

    const submitted = await performEKepegawaianAction(db, superAdmin, "submit-leave", {
      employeeId: employee?.id,
      leaveTypeId: annualLeave?.id,
      startDate: "2026-05-25",
      endDate: "2026-05-26",
      reason: "Keperluan keluarga.",
      addressDuringLeave: "Donggala",
      contactDuringLeave: "628123450014",
    });

    const submittedRequest = submitted as unknown as { id: string; status: string };
    expect(submittedRequest.status).toBe("waiting_supervisor_approval");

    const kasubagKepeg = await requireActorUser(db, "usr-kepeg");
    const afterSupervisor = await performEKepegawaianAction(db, kasubagKepeg, "approve-leave", {
      id: submittedRequest.id,
      note: "Disetujui atasan.",
    });

    expect((afterSupervisor as unknown as { status: string }).status).toBe("waiting_authorized_officer_approval");

    const ketua = await requireActorUser(db, "usr-ketua");
    const final = await performEKepegawaianAction(db, ketua, "approve-leave", {
      id: submittedRequest.id,
      note: "Disetujui pejabat berwenang.",
    });

    expect((final as unknown as { status: string }).status).toBe("approved");

    const dashboard = await getEKepegawaianDashboard(db, superAdmin);
    const balance = dashboard.leaveBalances.find((item) => item.employeeId === employee?.id);
    expect(balance?.usedDays).toBe(2);
    expect(balance?.pendingDays).toBe(0);
  });
});
