// @vitest-environment node

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { type AletaDatabase, createAletaDatabase } from "@/server/db/client";
import {
  getAletaBotSettings,
  getAletaBotSnapshot,
  listSendingRiskPresets,
  resolveSendingRiskPreset,
  updateAletaBotSettings,
} from "@/server/modules/aleta-bot/service";

describe("Slider Risiko pengiriman ALETA Bot", () => {
  describe("resolveSendingRiskPreset (clamp 1-5)", () => {
    it("mengembalikan preset sesuai level yang sah", () => {
      expect(resolveSendingRiskPreset(1).level).toBe(1);
      expect(resolveSendingRiskPreset(3).level).toBe(3);
      expect(resolveSendingRiskPreset(5).level).toBe(5);
    });

    it("membatasi nilai di luar 1-5 dan input tidak valid ke rentang aman", () => {
      expect(resolveSendingRiskPreset(0).level).toBe(1);
      expect(resolveSendingRiskPreset(-9).level).toBe(1);
      expect(resolveSendingRiskPreset(99).level).toBe(5);
      expect(resolveSendingRiskPreset(2.7).level).toBe(3);
      expect(resolveSendingRiskPreset("abc").level).toBe(1);
      expect(resolveSendingRiskPreset(null).level).toBe(1);
      expect(resolveSendingRiskPreset(undefined).level).toBe(1);
    });
  });

  describe("listSendingRiskPresets (5 tingkat, makin tinggi makin agresif)", () => {
    const presets = listSendingRiskPresets();

    it("menyediakan tepat 5 tingkat berurutan 1..5", () => {
      expect(presets).toHaveLength(5);
      expect(presets.map((item) => item.level)).toEqual([1, 2, 3, 4, 5]);
    });

    it("melabeli setiap tingkat dan risiko suspend/banned", () => {
      for (const preset of presets) {
        expect(preset.label.length).toBeGreaterThan(0);
        expect(preset.suspendRisk.length).toBeGreaterThan(0);
      }
    });

    it("menaikkan agresivitas seiring level: jeda mengecil, batas membesar", () => {
      for (let i = 1; i < presets.length; i += 1) {
        const lower = presets[i - 1];
        const higher = presets[i];
        // Level lebih tinggi = jeda lebih pendek (kirim lebih cepat).
        expect(higher.messageDelayMinMs).toBeLessThanOrEqual(lower.messageDelayMinMs);
        // Level lebih tinggi = batas per menit/jam/hari lebih besar.
        expect(higher.maxPerMinute).toBeGreaterThanOrEqual(lower.maxPerMinute);
        expect(higher.maxPerHour).toBeGreaterThanOrEqual(lower.maxPerHour);
        expect(higher.maxPerDay).toBeGreaterThanOrEqual(lower.maxPerDay);
      }
    });

    it("Minimal (L1) paling ketat: butuh persetujuan broadcast & jeda terbesar", () => {
      const minimal = presets[0];
      const maksimal = presets[presets.length - 1];
      expect(minimal.broadcastRequiresApproval).toBe(true);
      expect(minimal.messageDelayMinMs).toBeGreaterThan(0);
      expect(maksimal.maxPerMinute).toBeGreaterThan(minimal.maxPerMinute);
    });
  });

  describe("persistensi & snapshot", () => {
    let db: AletaDatabase | null = null;
    const previousRuntimeMode = process.env.WHATSAPP_RUNTIME_MODE;

    beforeAll(async () => {
      process.env.WHATSAPP_RUNTIME_MODE = "disabled";
      db = await createAletaDatabase({ useInMemory: true, seed: true });
      await getAletaBotSettings(db);
    }, 120000);

    afterAll(async () => {
      await db?.close();
      db = null;
      if (previousRuntimeMode === undefined) {
        delete process.env.WHATSAPP_RUNTIME_MODE;
      } else {
        process.env.WHATSAPP_RUNTIME_MODE = previousRuntimeMode;
      }
    });

    it("default awal adalah Minimal (level 1)", async () => {
      const settings = await getAletaBotSettings(db!);
      expect(settings.sendingRiskLevel).toBe(1);
    });

    it("menyimpan level yang dipilih dan membacanya kembali", async () => {
      const snapshot = await updateAletaBotSettings(db!, {
        actorUserId: "usr-super",
        payload: { sendingRiskLevel: 4 },
      });
      expect(snapshot.settings.sendingRiskLevel).toBe(4);

      const row = await db!
        .prepare(`SELECT sending_risk_level FROM aleta_bot_settings WHERE id = 1`)
        .get<{ sending_risk_level: number }>();
      expect(row?.sending_risk_level).toBe(4);

      const settings = await getAletaBotSettings(db!);
      expect(settings.sendingRiskLevel).toBe(4);
    });

    it("membatasi level di luar rentang saat disimpan", async () => {
      const tooHigh = await updateAletaBotSettings(db!, {
        actorUserId: "usr-super",
        payload: { sendingRiskLevel: 99 },
      });
      expect(tooHigh.settings.sendingRiskLevel).toBe(5);

      const tooLow = await updateAletaBotSettings(db!, {
        actorUserId: "usr-super",
        payload: { sendingRiskLevel: 0 },
      });
      expect(tooLow.settings.sendingRiskLevel).toBe(1);
    });

    it("snapshot menyertakan daftar preset untuk dashboard", async () => {
      const snapshot = await getAletaBotSnapshot(db!, "usr-super");
      expect(snapshot.sendingRiskPresets).toHaveLength(5);
      expect(snapshot.sendingRiskPresets.map((item) => item.level)).toEqual([1, 2, 3, 4, 5]);
    });
  });
});
