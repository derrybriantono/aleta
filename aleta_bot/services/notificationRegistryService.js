const { readRuntimeConfig } = require("../config/runtime-config");
const crypto = require("crypto");
const { validateQuery } = require("./queryValidatorService");
const { renderTemplate, validateTemplate } = require("./templateService");
const messageQueueService = require("./messageQueueService");
const { buildIdempotencyKey } = require("./idempotencyService");
const logService = require("./logService");
const runtimePolicyWarnings = new Set();
const runtimePolicyStats = {
  skippedCount: 0,
  lastSkippedAt: null,
  reasons: {},
};

function hashMessageBody(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

// Hardcoded pilot fallback — used when runtime config has no notifications yet
const pilotNotifications = [
  {
    key: "pegawai-kasir-harian",
    name: "Pengingat Kasir Harian",
    category: "employee",
    description: "Pilot pegawai dari sendPengingatKasir.",
    query_key: "legacy-kasir-panjar",
    template_key: "pegawai-monitoring",
    recipient_source: "users",
    recipient_column: "",
    identity_columns: ["nama_pegawai", "judul_notifikasi", "ringkasan"],
    schedule_config: { type: "cron", cron: "30 14 * * Monday-Thursday" },
    is_active: false,
    dry_run: false,
    requires_approval: false,
    max_recipients_per_run: 20,
    delay_ms: 1500,
    max_retries: 2,
    legacy_source_file: "app.js",
    legacy_source_hint: "sendPengingatKasir",
  },
  {
    key: "pegawai-penjaga-sidang-hari-ini",
    name: "Penjaga Sidang Hari Ini",
    category: "employee",
    description: "Pilot pegawai jadwal sidang internal.",
    query_key: "legacy-jadwal-sidang-internal",
    template_key: "pegawai-monitoring",
    recipient_source: "users",
    recipient_column: "",
    identity_columns: ["nama_pegawai", "tanggal_sidang", "agenda"],
    schedule_config: { type: "cron", cron: "10 07 * * Monday-Friday" },
    is_active: false,
    dry_run: false,
    requires_approval: false,
    max_recipients_per_run: 20,
    delay_ms: 1500,
    max_retries: 2,
    legacy_source_file: "app.js",
    legacy_source_hint: "sendPenjagaSidangHariIni",
  },
  {
    key: "pihak-sisa-panjar",
    name: "Notifikasi Sisa Panjar/Biaya",
    category: "party",
    description: "Pilot pihak sisa panjar/kekurangan biaya.",
    query_key: "legacy-pihak-sisa-panjar",
    template_key: "sisa-panjar",
    recipient_source: "query",
    recipient_column: "telepon",
    identity_columns: ["perkara_id", "nomor_perkara", "nama_pihak", "telepon"],
    schedule_config: { type: "cron", cron: "00 19 * * *" },
    is_active: false,
    dry_run: true,
    requires_approval: true,
    max_recipients_per_run: 10,
    delay_ms: 1500,
    max_retries: 2,
    legacy_source_file: "app.js",
    legacy_source_hint: "sendPihakSisaPanjar",
  },
  {
    key: "pihak-akta-cerai",
    name: "Notifikasi Akta Cerai",
    category: "party",
    description: "Pilot pihak akta cerai.",
    query_key: "legacy-pihak-akta-cerai",
    template_key: "akta-cerai",
    recipient_source: "query",
    recipient_column: "telepon",
    identity_columns: ["nomor_perkara", "nama_pihak", "telepon"],
    schedule_config: { type: "cron", cron: "00 16 * * *" },
    is_active: false,
    dry_run: true,
    requires_approval: true,
    max_recipients_per_run: 10,
    delay_ms: 1500,
    max_retries: 2,
    legacy_source_file: "app.js",
    legacy_source_hint: "sendPihakAktaCerai",
  },
  {
    key: "pihak-hari-sidang",
    name: "Notifikasi Pihak Hari Sidang",
    category: "party",
    description: "Pilot pihak jadwal sidang hari-H.",
    query_key: "legacy-pihak-hari-sidang",
    template_key: "jadwal-sidang",
    recipient_source: "query",
    recipient_column: "telepon",
    identity_columns: ["nomor_perkara", "nama_pihak", "tanggal_sidang", "telepon"],
    schedule_config: { type: "cron", cron: "00 07 * * *" },
    is_active: false,
    dry_run: true,
    requires_approval: true,
    max_recipients_per_run: 10,
    delay_ms: 1500,
    max_retries: 2,
    legacy_source_file: "app.js",
    legacy_source_hint: "sendPihakHariSidang",
  },
];

function mapPortalNotificationToRegistry(portalNotification, queries, templates) {
  const scheduleConfig = portalNotification.scheduleConfig || {};
  const recipientMapping = portalNotification.recipientMapping || {};
  const recipientColumn = String(recipientMapping.recipientColumn || "");
  const recipientGroup = String(recipientMapping.audienceGroup || recipientMapping.recipientGroup || "");

  const query = queries.find(
    (item) => item.id === portalNotification.queryId || item.name === portalNotification.queryId
  );
  const template = templates.find(
    (item) => item.id === portalNotification.templateId
  );

  return {
    key: String(portalNotification.id || ""),
    name: String(portalNotification.name || ""),
    category: portalNotification.category || "employee",
    description: String(portalNotification.description || ""),
    query_key: portalNotification.queryId || "",
    template_key: portalNotification.templateId || "",
    recipient_source: portalNotification.recipientSource || "users",
    recipient_group: recipientGroup,
    recipient_column: recipientColumn,
    identity_columns: query?.outputColumns || [],
    schedule_config: {
      type: scheduleConfig.type || "cron",
      cron: scheduleConfig.cron || "",
    },
    is_active: Boolean(portalNotification.isActive),
    dry_run: Boolean(portalNotification.dryRunEnabled ?? true),
    requires_approval: portalNotification.category === "party",
    policy_status: portalNotification.policyStatus || null,
    max_recipients_per_run: 20,
    delay_ms: Number(portalNotification.delayMs || 1500),
    max_retries: Number(portalNotification.retryLimit || 2),
    legacy_source_file: query?.sqlText?.startsWith("legacy:") ? "notifikasi.js" : "portal",
    legacy_source_hint: portalNotification.id,
    _query: query || null,
    _template: template || null,
    _fromPortal: true,
  };
}

function getEffectiveNotifications() {
  const runtimeConfig = readRuntimeConfig();
  const queries = runtimeConfig.queries || [];
  const templates = runtimeConfig.templates || [];
  const portalNotifications = Array.isArray(runtimeConfig.notifications) ? runtimeConfig.notifications : [];

  // Portal notifications take precedence when available
  if (portalNotifications.length > 0) {
    return portalNotifications.map((n) => mapPortalNotificationToRegistry(n, queries, templates));
  }

  // Fall back to hardcoded pilot
  return pilotNotifications;
}

function notificationPassesRuntimePolicy(notification) {
  if (notification.category !== "party") return true;
  const policy = notification.policy_status || {};
  const reasons = [];
  if (!policy.dryRunPassed) reasons.push("belum_dry_run");
  if (!policy.recipientPreviewPassed) reasons.push("belum_preview");
  if (!policy.approved) reasons.push("belum_approval");
  if (policy.canActivate === false) reasons.push("belum_bisa_aktif");
  const allowed = Boolean(
    policy.dryRunPassed &&
    policy.recipientPreviewPassed &&
    policy.approved &&
    policy.canActivate
  );
  if (!allowed && notification.is_active && !runtimePolicyWarnings.has(notification.key)) {
    runtimePolicyWarnings.add(notification.key);
    runtimePolicyStats.skippedCount += 1;
    runtimePolicyStats.lastSkippedAt = new Date().toISOString();
    for (const reason of reasons.length > 0 ? reasons : ["policy_tidak_lengkap"]) {
      runtimePolicyStats.reasons[reason] = (runtimePolicyStats.reasons[reason] || 0) + 1;
      void logService.logPolicySkip({
        notificationKey: notification.key || "",
        notificationId: notification.id || notification.key || "",
        category: notification.category || "party",
        reason,
        sourceFeature: notification.key || "notification_registry",
        entityType: "notification",
        entityId: notification.key || "",
        recipientType: "party",
        metadata: {
          policyStatus: {
            dryRunPassed: Boolean(policy.dryRunPassed),
            recipientPreviewPassed: Boolean(policy.recipientPreviewPassed),
            approved: Boolean(policy.approved),
            canActivate: Boolean(policy.canActivate),
          },
          source: notification._fromPortal ? "portal" : "runtime",
        },
      }).catch(() => {});
    }
    console.warn(
      `[ALETA Bot] Notifikasi pihak ${notification.key || "unknown"} dilewati oleh runtime policy. ` +
        "Simulasi, preview penerima, dan approval harus selesai sebelum aktif."
    );
  }
  return allowed;
}

function getRegistrySnapshot() {
  const runtimeConfig = readRuntimeConfig();
  const queries = runtimeConfig.queries || [];
  const templates = runtimeConfig.templates || [];
  const portalNotifications = Array.isArray(runtimeConfig.notifications) ? runtimeConfig.notifications : [];
  const usePortal = portalNotifications.length > 0;

  const effectiveNotifications = usePortal
    ? portalNotifications.map((n) => mapPortalNotificationToRegistry(n, queries, templates))
    : pilotNotifications;

  const notifications = effectiveNotifications.map((notification) => {
    const query = notification._query || queries.find((item) => item.id === notification.query_key || item.name === notification.query_key);
    const template = notification._template || templates.find((item) => item.id === notification.template_key);
    const outputColumns = query?.outputColumns || notification.identity_columns;
    const queryValidation = query
      ? validateQuery(query.sqlText, {
          category: notification.category,
          recipientColumn: notification.recipient_column,
          outputColumns,
        })
      : { valid: false, errors: ["query_not_found"], warnings: [], safeForPreview: false };
    const templateValidation = template
      ? validateTemplate(template, {
          category: notification.category,
          outputColumns,
          requiredPlaceholders: [],
        })
      : { valid: false, placeholders: [], errors: ["template_not_found"], warnings: [] };

    return {
      ...notification,
      connection_key: query?.connectionKey || "sipp_primary",
      query_validation: queryValidation,
      template_validation: templateValidation,
    };
  });

  return {
    useRegistryNotifications: runtimeConfig.useRegistryNotifications,
    registryPilotMode: runtimeConfig.registryPilotMode,
    registryDryRunDefault: runtimeConfig.registryDryRunDefault,
    disabledLegacyNotificationKeys: runtimeConfig.disabledLegacyNotificationKeys || [],
    source: usePortal ? "portal" : "hardcoded_pilot",
    total: notifications.length,
    active: notifications.filter((item) => item.is_active).length,
    dryRun: notifications.filter((item) => item.dry_run).length,
    requiresApproval: notifications.filter((item) => item.requires_approval).length,
    skippedPolicy: notifications.filter((item) => item.is_active && !notificationPassesRuntimePolicy(item)).length,
    policySkipStats: { ...runtimePolicyStats, reasons: { ...runtimePolicyStats.reasons } },
    notifications,
  };
}

async function getRegistrySnapshotAsync() {
  const snapshot = getRegistrySnapshot();
  try {
    const persisted = await logService.getPolicySkipStats();
    return {
      ...snapshot,
      policySkipStats: {
        ...snapshot.policySkipStats,
        ...persisted,
        reasons: { ...(snapshot.policySkipStats?.reasons || {}), ...(persisted.reasons || {}) },
      },
    };
  } catch {
    return snapshot;
  }
}

function getActiveNotifications() {
  return getEffectiveNotifications().filter((notification) => notification.is_active && notificationPassesRuntimePolicy(notification));
}

function makePilotSample(notification, overrides = {}) {
  return {
    perkara_id: "pilot-registry",
    nomor_perkara: "000/Pdt.G/2026/PA.Dgl",
    nama_pihak: "Contoh Pihak",
    nama_pegawai: "Contoh Pegawai",
    jabatan: "Pegawai",
    judul_notifikasi: notification.name,
    ringkasan: notification.description,
    agenda: "Agenda sidang",
    hari_sidang: "Senin",
    tanggal_sidang: "27-04-2026",
    ruangan: "Ruang Sidang 1",
    sisa_panjar: "Rp0",
    telepon: "628123456789",
    waktu: new Date().toLocaleString("id-ID"),
    mode: "dry-run",
    ...overrides,
  };
}

async function enqueuePilotDryRun(notificationKey, sampleData = {}) {
  const runtimeConfig = readRuntimeConfig();
  const allNotifications = getEffectiveNotifications();
  const notification = allNotifications.find(
    (item) => item.key === notificationKey || item.key === notificationKey
  ) || pilotNotifications.find((item) => item.key === notificationKey);
  if (!notification) {
    throw new Error(`Pilot registry tidak ditemukan: ${notificationKey}`);
  }

  const query = (runtimeConfig.queries || []).find((item) => item.id === notification.query_key || item.name === notification.query_key);
  const template = (runtimeConfig.templates || []).find((item) => item.id === notification.template_key);
  if (!query) throw new Error(`Query registry tidak ditemukan: ${notification.query_key}`);
  if (!template) throw new Error(`Template registry tidak ditemukan: ${notification.template_key}`);

  const outputColumns = query.outputColumns || notification.identity_columns;
  const queryValidation = validateQuery(query.sqlText, {
    category: notification.category,
    recipientColumn: notification.recipient_column,
    outputColumns,
  });
  if (!queryValidation.valid) {
    throw new Error(`Query registry tidak valid: ${queryValidation.errors.join(", ")}`);
  }

  const templateValidation = validateTemplate(template, {
    category: notification.category,
    outputColumns,
    requiredPlaceholders: [],
  });
  if (!templateValidation.valid) {
    throw new Error(`Template registry tidak valid: ${templateValidation.errors.join(", ")}`);
  }

  const sample = makePilotSample(notification, sampleData);
  const message = renderTemplate(template, sample);
  const recipientNumber =
    sample[notification.recipient_column] ||
    sample.telepon ||
    runtimeConfig.testTargetNumber ||
    runtimeConfig.adminWhatsappNumber;
  const idempotencyKey = buildIdempotencyKey({
    notificationKey: notification.key,
    perkaraId: sample.perkara_id,
    nomorPerkara: sample.nomor_perkara,
    recipientNumber,
    eventDate: new Date().toISOString().slice(0, 10),
    messageType: "registry-dry-run",
  });

  return messageQueueService.enqueueMessage({
    idempotencyKey,
    recipientNumber,
    recipientName: sample.nama_pihak || sample.nama_pegawai || notification.name,
    message,
    category: notification.category,
    notificationKey: notification.key,
    maxRetries: notification.max_retries,
    priority: notification.category === "party" ? 6 : 5,
    sourceApp: "aleta_bot",
    sourceFeature: notification.category === "party" ? "notification_party" : "notification_employee",
    entityType: "notification",
    entityId: notification.key,
    metadata: {
      sourceApp: "aleta_bot",
      sourceFeature: notification.category === "party" ? "notification_party" : "notification_employee",
      messageContractVersion: "aleta-template-v1",
      messageContractSource: "notification_registry",
      messageContractTraceId: idempotencyKey,
      messageSha256: hashMessageBody(message),
      messageLength: message.length,
      renderedAt: new Date().toISOString(),
      entityType: "notification",
      entityId: notification.key,
      recipientType: notification.category === "party" ? "party" : "employee",
      nomorPerkara: sample.nomor_perkara || "",
      dryRun: true,
      registryPilot: true,
      queryKey: notification.query_key,
      templateKey: notification.template_key,
      connectionKey: query.connectionKey || "sipp_primary",
    },
  });
}

module.exports = {
  pilotNotifications,
  getRegistrySnapshot,
  getRegistrySnapshotAsync,
  getActiveNotifications,
  getEffectiveNotifications,
  notificationPassesRuntimePolicy,
  runtimePolicyStats,
  enqueuePilotDryRun,
};
