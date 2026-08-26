// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type AletaDatabase, createAletaDatabase } from "@/server/db/client";
import {
  activateLegacyRegistry,
  getAletaBotSnapshot,
  processApproval,
  submitLegacyMigrationApproval,
  updateAletaBotNotification,
} from "@/server/modules/aleta-bot/service";

/**
 * Aktivasi notifikasi PIHAK.
 *
 * Dulu notifikasi pihak wajib melewati ritual "simulasi → preview → approval",
 * dan approval hanya bisa diajukan lewat "Migrasi Jalur Lama". Dua bug membuat
 * notifikasi BAWAAN mustahil diaktifkan:
 *   1. entityId approval migrasi ("party-*") tidak pernah sama dengan id
 *      notifikasi ("pihak-*"), jadi badge "Approval" selamanya "Belum".
 *   2. aktivasi registry melingkar dengan disable-legacy ("Duplicate path guard").
 *
 * Perbaikan: notifikasi bawaan standar diperlakukan sudah-disetujui secara
 * bawaan (admin cukup mengaktifkan), dan guard melingkar dibuang.
 */
let db: AletaDatabase | null = null;

beforeEach(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: true });
});

afterEach(async () => {
  await db?.close();
  db = null;
});

async function partyNotifications() {
  const snap = await getAletaBotSnapshot(db!, "usr-super");
  return snap.notifications.filter((n) => n.category === "party");
}

describe("notifikasi pihak bawaan disetujui secara bawaan", () => {
  it("semua notifikasi pihak bawaan berstatus dapat diaktifkan", async () => {
    const party = await partyNotifications();
    expect(party.length).toBeGreaterThan(0);
    for (const n of party) {
      expect(n.policyStatus?.approved, `${n.id} approved`).toBe(true);
      expect(n.policyStatus?.canActivate, `${n.id} canActivate`).toBe(true);
    }
  });

  it("notifikasi pihak bawaan bisa langsung diaktifkan tanpa ritual", async () => {
    const party = await partyNotifications();
    const target = party.find((n) => n.id === "pihak-akta-cerai") ?? party[0];

    await updateAletaBotNotification(db!, {
      actorUserId: "usr-super",
      notification: {
        ...target,
        isActive: true,
        scheduleConfig: { type: "cron", cron: "00 16 * * *", trigger: "cron sore" },
      },
    });

    const sesudah = (await partyNotifications()).find((n) => n.id === target.id);
    expect(sesudah?.isActive).toBe(true);
  });

  it("notifikasi pihak BUATAN admin tetap dijaga (tidak bisa aktif tanpa approval)", async () => {
    // Pakai pasangan query+template bawaan yang placeholder-nya cocok, tetapi
    // dengan id BUATAN (bukan bawaan), lalu buat NONAKTIF dulu.
    const bawaan = (await partyNotifications()).find((n) => n.id === "pihak-akta-cerai")!;
    const custom = {
      id: "custom-party-uji",
      name: "Uji Notifikasi Pihak Buatan",
      category: "party" as const,
      queryId: bawaan.queryId,
      templateId: bawaan.templateId,
      isActive: false,
      scheduleConfig: { type: "cron" as const, cron: "00 16 * * *", trigger: "cron sore" },
      recipientMapping: { recipientColumn: "telepon" },
    };
    await updateAletaBotNotification(db!, { actorUserId: "usr-super", notification: custom });

    // Notifikasi buatan admin TIDAK otomatis disetujui.
    const tersimpan = (await partyNotifications()).find((n) => n.id === "custom-party-uji");
    expect(tersimpan?.policyStatus?.approved).toBe(false);
    expect(tersimpan?.policyStatus?.canActivate).toBe(false);

    // Dan mengaktifkannya ditolak sampai ritual selesai.
    await expect(
      updateAletaBotNotification(db!, {
        actorUserId: "usr-super",
        notification: { ...custom, isActive: true },
      })
    ).rejects.toThrow(/belum dapat diaktifkan|simulasi|approval/i);
  });
});

describe("migrasi jalur lama tidak lagi buntu", () => {
  it("aktivasi registry tidak lagi melempar 'Duplicate path guard'", async () => {
    const snap = await getAletaBotSnapshot(db!, "usr-super");
    const migration = snap.legacyMigrations.find(
      (m) => (m.legacyType === "party_notification" || m.legacyType === "employee_notification") && m.legacyKey
    );
    expect(migration).toBeTruthy();
    const migrationId = migration!.id;

    // Bukti bahwa guard melingkar sudah hilang: pada kode LAMA, aktivasi tanpa
    // disable-legacy langsung melempar "Duplicate path guard" SEBELUM sampai ke
    // pemeriksaan lain. Sekarang, untuk migrasi high-risk tanpa approval, yang
    // muncul justru pesan approval — artinya guard melingkar tak lagi menghadang.
    await expect(activateLegacyRegistry(db!, "usr-super", migrationId)).rejects.toThrow(/approval/i);
    await expect(activateLegacyRegistry(db!, "usr-super", migrationId)).rejects.not.toThrow(/duplicate path guard/i);

    // Alur lengkap sekarang bisa selesai sampai registry aktif.
    const hasil = await submitLegacyMigrationApproval(db!, "usr-super", migrationId);
    await processApproval(db!, { actorUserId: "usr-super", approvalId: hasil.approval.id, decision: "approved" });
    await activateLegacyRegistry(db!, "usr-super", migrationId);

    const sesudah = (await getAletaBotSnapshot(db!, "usr-super")).legacyMigrations.find((m) => m.id === migrationId);
    expect(sesudah?.status).toBe("active_registry");
  });
});
