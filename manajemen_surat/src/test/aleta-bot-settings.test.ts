// @vitest-environment node

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AletaBotSnapshot } from "@/lib/aleta-bot-types";
import { type AletaDatabase, createAletaDatabase } from "@/server/db/client";
import {
  getAletaBotSettings,
  runAletaBotAction,
  updateAletaBotSettings,
} from "@/server/modules/aleta-bot/service";

describe("ALETA Bot settings persistence", () => {
  let db: AletaDatabase | null = null;
  const previousRuntimeMode = process.env.WHATSAPP_RUNTIME_MODE;

  beforeAll(async () => {
    process.env.WHATSAPP_RUNTIME_MODE = "disabled";
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    await getAletaBotSettings(db);
  }, 120000);

  beforeEach(async () => {
    await db!
      .prepare(`UPDATE aleta_bot_settings SET admin_whatsapp_number = '', updated_at = ? WHERE id = 1`)
      .run(new Date().toISOString());
  });

  afterAll(async () => {
    await db?.close();
    db = null;
    if (previousRuntimeMode === undefined) {
      delete process.env.WHATSAPP_RUNTIME_MODE;
    } else {
      process.env.WHATSAPP_RUNTIME_MODE = previousRuntimeMode;
    }
  });

  it("stores the submitted admin WhatsApp number in aleta_bot_settings", async () => {
    const snapshot = await updateAletaBotSettings(db!, {
      actorUserId: "usr-super",
      payload: {
        adminWhatsappNumber: "0812-3456-7890",
      },
    });

    expect(snapshot.settings.adminWhatsappNumber).toBe("6281234567890");

    const row = await db!
      .prepare(`SELECT admin_whatsapp_number FROM aleta_bot_settings WHERE id = 1`)
      .get<{ admin_whatsapp_number: string }>();
    expect(row?.admin_whatsapp_number).toBe("6281234567890");

    const settings = await getAletaBotSettings(db!);
    expect(settings.adminWhatsappNumber).toBe("6281234567890");
  }, 90000);

  it("clears the admin WhatsApp number when an empty value is submitted", async () => {
    await updateAletaBotSettings(db!, {
      actorUserId: "usr-super",
      payload: {
        adminWhatsappNumber: "6281234567890",
      },
    });

    const snapshot = await updateAletaBotSettings(db!, {
      actorUserId: "usr-super",
      payload: {
        adminWhatsappNumber: "   ",
      },
    });

    expect(snapshot.settings.adminWhatsappNumber).toBe("");
    const row = await db!
      .prepare(`SELECT admin_whatsapp_number FROM aleta_bot_settings WHERE id = 1`)
      .get<{ admin_whatsapp_number: string }>();
    expect(row?.admin_whatsapp_number).toBe("");
  }, 90000);

  it("explains that manual test send is only simulated while dry-run mode is active", async () => {
    const snapshot = await runAletaBotAction(db!, {
      actorUserId: "usr-super",
      action: "send-test",
      payload: {
        to: "0812-3456-7890",
        message: "Tes pengiriman ALETA Bot",
      },
    }) as AletaBotSnapshot & {
      actionResult?: {
        dryRun?: boolean;
        sent?: boolean;
        message?: string;
      };
    };

    expect(snapshot.actionResult?.dryRun).toBe(true);
    expect(snapshot.actionResult?.sent).toBe(false);
    expect(snapshot.actionResult?.message).toContain("Mode simulasi masih aktif");
  }, 90000);
});
