// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { UserPersona } from "@/lib/types";
import { type AletaDatabase, createAletaDatabase } from "@/server/db/client";
import {
  assertAnonymizerUploadMetadata,
  detectSensitiveEntities,
} from "@/server/modules/judicia/legal-form/anonymization/jlf-anonymization-service";
import { logAction, listAuditLogs } from "@/server/modules/judicia/legal-form/jlf-audit-log-service";
import { getJlfDashboardSummary } from "@/server/modules/judicia/legal-form/jlf-reporting-service";
import { requireActorUser } from "@/server/modules/organization/service";

describe("JLF anonymizer, dashboard, and audit safety", () => {
  let db: AletaDatabase | null = null;

  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
  });

  afterEach(async () => {
    await db?.close();
    db = null;
  });

  it("detects rule-based sensitive entities and party names from case context", () => {
    const suggestions = detectSensitiveEntities(
      "Penggugat Siti Aminah NIK 7371010101010001 email siti@example.test telepon 081234567890 tinggal di Jalan Melati Nomor 10.",
      { partyNames: ["Siti Aminah"] }
    );

    expect(suggestions.map((item) => item.type)).toEqual(expect.arrayContaining(["party_name", "nik", "email", "phone", "address"]));
  });

  it("rejects executable uploads before anonymizer processing", () => {
    expect(() => assertAnonymizerUploadMetadata({ name: "payload.exe", size: 32, type: "application/octet-stream" }, ["txt", "rtf"], 1)).toThrow(
      "File executable"
    );
  });

  it("returns dashboard summary without exposing secrets", async () => {
    const actor = await requireActorUser(db!, "usr-super");
    const summary = await getJlfDashboardSummary(db!, actor);

    expect(summary.secretsExposed).toBe(false);
    expect(summary.statuses.sipp.rawSqlEndpoint).toBe(false);
    expect(summary.statuses.sipp.readOnly).toBe(true);
  });

  it("requires audit permission and masks sensitive metadata", async () => {
    const actor = await requireActorUser(db!, "usr-super");
    await logAction(db!, {
      userId: actor.id,
      action: "ai.use",
      entityType: "jlf_ai",
      metadata: {
        providerToken: "secret-token",
        rawInput: "NIK 7371010101010001",
        visible: "ringkas",
      },
    });

    const logs = await listAuditLogs(db!, actor, { eventGroup: "ai", limit: 10 });
    expect(JSON.stringify(logs.items[0]?.metadata)).toContain("[disamarkan]");
    expect(JSON.stringify(logs.items[0]?.metadata)).toContain("ringkas");

    const noAccessActor: UserPersona = {
      id: "usr-no-jlf-audit",
      username: "nojlf",
      password: "",
      name: "No JLF",
      nip: "",
      email: "nojlf@example.test",
      whatsappNumber: "",
      roleId: "sekretaris",
      positionId: "pos-sekretaris",
      additionalRoleIds: [],
      isActive: true,
    };
    await expect(listAuditLogs(db!, noAccessActor, {})).rejects.toThrow("Anda tidak memiliki izin Judicia Legal Form");
  });
});
