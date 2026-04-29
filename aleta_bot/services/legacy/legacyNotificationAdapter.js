/**
 * legacyNotificationAdapter.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 5 — Legacy Notification Adapter
 *
 * Wraps all legacy notification functions from app.js / notifikasi.js into a
 * normalized interface. Provides:
 *  - A registry of all legacy notification keys and their metadata
 *  - runLegacyNotification(key, options) dispatcher
 *  - Safe dry-run mode by default
 *  - Per-function audit logging via logService
 *
 * IMPORTANT: This adapter does NOT send real WhatsApp messages directly.
 * It delegates to the caller (app.js cron handlers or a new registry runner)
 * which in turn calls safeSendMessage. This keeps the existing send path intact
 * while giving portal visibility into what each legacy function does.
 *
 * Phase 5 migration_key → source function mapping is intentionally 1-to-1 with
 * the aleta_bot_legacy_migrations entries in manajemen_surat service.ts.
 */

"use strict";

const notification = require("../../notifikasi");
const logService = require("../logService");
const { readRuntimeConfig } = require("../../config/runtime-config");

/**
 * Registry of all legacy notification functions.
 * Each entry describes what data query to call and metadata for the migration tracker.
 *
 * @type {Record<string, {
 *   legacyKey: string,
 *   feature: string,
 *   legacyType: "party_notification" | "employee_notification",
 *   cronSchedule: string,
 *   riskLevel: "low" | "medium" | "high",
 *   getDataFn: string,                 // name of notifikasi.js function
 *   recipientType: "party" | "employee" | "per_employee",
 *   requiresApproval: boolean,
 *   canDryRun: boolean,
 * }>}
 */
const LEGACY_NOTIFICATION_REGISTRY = {
  "sendPihakBaru": {
    legacyKey: "sendPihakBaru",
    feature: "Notifikasi Pihak Baru (Pendaftaran Perkara)",
    legacyType: "party_notification",
    cronSchedule: "00 17 * * Monday-Friday",
    riskLevel: "high",
    getDataFn: "getDataPihakBaru",
    recipientType: "party",
    requiresApproval: true,
    canDryRun: true,
  },
  "sendPihakAktaCerai": {
    legacyKey: "sendPihakAktaCerai",
    feature: "Notifikasi Pihak Akta Cerai Terbit",
    legacyType: "party_notification",
    cronSchedule: "00 16 * * *",
    riskLevel: "high",
    getDataFn: "getDataPihakAktaCerai",
    recipientType: "party",
    requiresApproval: true,
    canDryRun: true,
  },
  "sendPihakSisaPanjar": {
    legacyKey: "sendPihakSisaPanjar",
    feature: "Notifikasi Sisa Panjar ke Pihak",
    legacyType: "party_notification",
    cronSchedule: "00 19 * * *",
    riskLevel: "high",
    getDataFn: "getDataPihakSisaPanjar",
    recipientType: "party",
    requiresApproval: true,
    canDryRun: true,
  },
  "sendPihakPanjarBelum": {
    legacyKey: "sendPihakPanjarBelum",
    feature: "Notifikasi Pihak Belum Bayar Panjar",
    legacyType: "party_notification",
    cronSchedule: "30 15 * * *",
    riskLevel: "high",
    getDataFn: "getDataHabisBiaya",
    recipientType: "party",
    requiresApproval: true,
    canDryRun: true,
  },
  "sendPihakPutusan": {
    legacyKey: "sendPihakPutusan",
    feature: "Notifikasi Putusan ke Pihak",
    legacyType: "party_notification",
    cronSchedule: "30 23 * * *",
    riskLevel: "high",
    getDataFn: "getDataPutusanPihak",
    recipientType: "party",
    requiresApproval: true,
    canDryRun: true,
  },
  "sendPihakHariSidang": {
    legacyKey: "sendPihakHariSidang",
    feature: "Notifikasi Pihak Hari Sidang",
    legacyType: "party_notification",
    cronSchedule: "00 07 * * *",
    riskLevel: "high",
    getDataFn: "getDataPihakHariSidang",
    recipientType: "party",
    requiresApproval: true,
    canDryRun: true,
  },
  "sendPihakSebelumHariSidang": {
    legacyKey: "sendPihakSebelumHariSidang",
    feature: "Notifikasi Pihak 3 Hari Sebelum Sidang",
    legacyType: "party_notification",
    cronSchedule: "00 09 * * *",
    riskLevel: "high",
    getDataFn: "getDataPihakSebelumHariSidang",
    recipientType: "party",
    requiresApproval: true,
    canDryRun: true,
  },
  "sendPihakTundaCuti": {
    legacyKey: "sendPihakTundaCuti",
    feature: "Notifikasi Tunda Sidang karena Cuti (one-time)",
    legacyType: "party_notification",
    cronSchedule: "00 12 24 11 *",
    riskLevel: "low",
    getDataFn: "getDataPihakTundaCuti",
    recipientType: "party",
    requiresApproval: false,
    canDryRun: true,
  },
  "sendKetuaPenerimaanPerkara": {
    legacyKey: "sendKetuaPenerimaanPerkara",
    feature: "Laporan Bulanan Penerimaan Perkara ke Ketua",
    legacyType: "employee_notification",
    cronSchedule: "50 07 1 * *",
    riskLevel: "medium",
    getDataFn: "getTotalPenerimaanPerkaraSemuaHakimLengkap",
    recipientType: "per_employee",
    requiresApproval: false,
    canDryRun: true,
  },
  "sendPanitera": {
    legacyKey: "sendPanitera",
    feature: "Laporan Bulanan Penerimaan Perkara ke Panitera",
    legacyType: "employee_notification",
    cronSchedule: "50 07 1 * *",
    riskLevel: "medium",
    getDataFn: "getTotalPenerimaanPerkaraSemuaPaniteraLengkap",
    recipientType: "per_employee",
    requiresApproval: false,
    canDryRun: true,
  },
  "sendPenjagaSidangHariIni": {
    legacyKey: "sendPenjagaSidangHariIni",
    feature: "Notifikasi Penjaga Sidang Hari Ini",
    legacyType: "employee_notification",
    cronSchedule: "10 07 * * Monday-Friday",
    riskLevel: "medium",
    getDataFn: "getDataJadwalSidangPerdata",
    recipientType: "employee",
    requiresApproval: false,
    canDryRun: true,
  },
  "sendPenjagaSidangBesok": {
    legacyKey: "sendPenjagaSidangBesok",
    feature: "Notifikasi Penjaga Sidang Besok",
    legacyType: "employee_notification",
    cronSchedule: "00 20 * * *",
    riskLevel: "medium",
    getDataFn: "getDataJadwalBesok",
    recipientType: "employee",
    requiresApproval: false,
    canDryRun: true,
  },
  "sendPengingatKasir": {
    legacyKey: "sendPengingatKasir",
    feature: "Notifikasi Pengingat Kasir Harian",
    legacyType: "employee_notification",
    cronSchedule: "30 14 * * Monday-Thursday",
    riskLevel: "low",
    getDataFn: "getDataSisaPanjarPn",
    recipientType: "employee",
    requiresApproval: false,
    canDryRun: true,
  },
};

/**
 * Get the full registry snapshot.
 * Used by the portal dashboard for Phase 5 migration tracking.
 */
function isLegacyKeyDisabled(legacyKey) {
  const config = readRuntimeConfig();
  const disabled = [
    ...(Array.isArray(config.disabledLegacyKeys) ? config.disabledLegacyKeys : []),
    ...(Array.isArray(config.disabledLegacyNotificationKeys) ? config.disabledLegacyNotificationKeys : []),
  ].map((key) => String(key || ""));
  return disabled.includes(legacyKey);
}

function getRegistrySnapshot() {
  return Object.values(LEGACY_NOTIFICATION_REGISTRY).map((entry) => ({
    ...entry,
    status: isLegacyKeyDisabled(entry.legacyKey) ? "legacy_disabled" : "legacy_active", // app.js crons may still need key-by-key binding
    runtimeBinding: isLegacyKeyDisabled(entry.legacyKey) ? "adapter_disabled" : "legacy_fallback",
  }));
}

/**
 * Get a single registry entry by legacy key.
 * @param {string} legacyKey - e.g. "sendPihakBaru"
 * @returns {object|null}
 */
function getRegistryEntry(legacyKey) {
  const entry = LEGACY_NOTIFICATION_REGISTRY[legacyKey] ?? null;
  return entry ? { ...entry, disabled: isLegacyKeyDisabled(legacyKey) } : null;
}

function detectDuplicateNotificationPaths(registryNotifications = []) {
  const activeLegacy = getRegistrySnapshot().filter((entry) => entry.status !== "legacy_disabled");
  const activeRegistry = Array.isArray(registryNotifications) ? registryNotifications : [];
  return activeLegacy.flatMap((legacy) => {
    return activeRegistry
      .filter((registry) => {
        const haystack = `${registry.id || ""} ${registry.name || ""} ${registry.scheduleConfig?.cron || ""} ${registry.schedule_config?.cron || ""}`.toLowerCase();
        const needle = `${legacy.legacyKey} ${legacy.feature} ${legacy.cronSchedule}`.toLowerCase();
        return haystack.includes(String(legacy.legacyKey).toLowerCase()) || (legacy.cronSchedule && needle.includes(String(registry.scheduleConfig?.cron || registry.schedule_config?.cron || "").toLowerCase()));
      })
      .map((registry) => ({
        legacyKey: legacy.legacyKey,
        legacyFeature: legacy.feature,
        registryKey: registry.id || registry.key || registry.name || "unknown",
        severity: "critical",
        reason: "Legacy notification dan registry notification berpotensi aktif pada jalur/schedule yang sama.",
      }));
  });
}

/**
 * Run data query for a given legacy notification key (dry-run only).
 * Does NOT send messages — only fetches the data that would be sent,
 * for preview/audit purposes.
 *
 * @param {string} legacyKey - registry key, e.g. "sendPihakBaru"
 * @returns {Promise<{ ok: boolean, legacyKey: string, feature: string, dataFn: string, rowCount: number, preview: any }>}
 */
async function previewLegacyNotificationData(legacyKey) {
  const entry = LEGACY_NOTIFICATION_REGISTRY[legacyKey];
  if (!entry) {
    throw new Error(`Legacy notification key tidak dikenal: "${legacyKey}"`);
  }
  if (isLegacyKeyDisabled(legacyKey)) {
    return {
      ok: false,
      legacyKey,
      feature: entry.feature,
      dataFn: entry.getDataFn,
      skipped: true,
      error: "Legacy key sudah dinonaktifkan melalui runtime config.",
    };
  }

  const dataFn = notification[entry.getDataFn];
  if (typeof dataFn !== "function") {
    throw new Error(`Fungsi notifikasi.js "${entry.getDataFn}" tidak ditemukan.`);
  }

  const startedAt = new Date().toISOString();

  try {
    const data = await dataFn();

    // Normalize: data may be array, { pihakP, pihakT, ... }, or a single row
    let rowCount = 0;
    let preview = null;
    if (Array.isArray(data)) {
      rowCount = data.length;
      preview = data.slice(0, 3);
    } else if (data && typeof data === "object") {
      const arrays = Object.values(data).filter(Array.isArray);
      rowCount = arrays.reduce((sum, arr) => sum + arr.length, 0);
      preview = data;
    } else if (data) {
      rowCount = 1;
      preview = data;
    }

    await logService.logSystemEvent({
      eventType: "legacy_notification_preview",
      severity: "info",
      message: `Preview data notifikasi legacy: ${entry.feature} — ${rowCount} baris.`,
      metadata: {
        legacyKey,
        feature: entry.feature,
        getDataFn: entry.getDataFn,
        rowCount,
        startedAt,
        completedAt: new Date().toISOString(),
      },
    });

    return {
      ok: true,
      legacyKey,
      feature: entry.feature,
      dataFn: entry.getDataFn,
      cronSchedule: entry.cronSchedule,
      riskLevel: entry.riskLevel,
      requiresApproval: entry.requiresApproval,
      rowCount,
      preview,
    };
  } catch (error) {
    await logService.logSystemEvent({
      eventType: "legacy_notification_preview_failed",
      severity: "error",
      message: `Gagal preview data notifikasi legacy: ${entry.feature}.`,
      metadata: {
        legacyKey,
        feature: entry.feature,
        getDataFn: entry.getDataFn,
        errorMessage: error.message,
        startedAt,
        completedAt: new Date().toISOString(),
      },
    });
    return {
      ok: false,
      legacyKey,
      feature: entry.feature,
      dataFn: entry.getDataFn,
      error: error.message,
    };
  }
}

/**
 * Run all previews and return a full health snapshot.
 * Used by the portal "Migrasi Legacy" dashboard panel.
 * This is READ-ONLY — it only calls the data functions, never sends messages.
 *
 * @returns {Promise<Array<object>>}
 */
async function previewAllLegacyNotifications() {
  const keys = Object.keys(LEGACY_NOTIFICATION_REGISTRY);
  const results = await Promise.allSettled(
    keys.map((key) => previewLegacyNotificationData(key))
  );

  return results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return {
      ok: false,
      legacyKey: keys[i],
      error: r.reason?.message ?? "Unknown error",
    };
  });
}

module.exports = {
  getRegistrySnapshot,
  getRegistryEntry,
  isLegacyKeyDisabled,
  detectDuplicateNotificationPaths,
  previewLegacyNotificationData,
  previewAllLegacyNotifications,
  LEGACY_NOTIFICATION_REGISTRY,
};
