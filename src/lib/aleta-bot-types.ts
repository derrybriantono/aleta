export type AletaBotRuntimeState = "active" | "disabled" | "dry-run" | "error";
export type AletaBotLogLevel = "info" | "warning" | "error" | "success";
export type AletaBotLogType =
  | "connection"
  | "message"
  | "settings"
  | "template"
  | "query"
  | "notification"
  | "admin";
export type AletaBotNotificationCategory = "employee" | "party";
export type AletaBotQueryCategory = "employee" | "party" | "system";

export type AletaBotSettings = {
  botEnabled: boolean;
  notificationsEnabled: boolean;
  adminWhatsappNumber: string;
  messageDelayMs: number;
  retryLimit: number;
  dryRunEnabled: boolean;
  scheduleCron: string;
  testTargetNumber: string;
  securityNotes: string;
  updatedAt: string;
};

export type AletaBotTemplate = {
  id: string;
  category: string;
  title: string;
  body: string;
  placeholders: string[];
  editable: boolean;
  updatedAt: string;
};

export type AletaBotJob = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  scheduleCron: string;
  lastRunAt: string | null;
  lastStatus: "idle" | "success" | "failed" | "simulated";
  lastMessage: string | null;
  updatedAt: string;
};

export type AletaBotQueryCatalogItem = {
  id: string;
  sourceFile: "app.js" | "notifikasi.js" | "query.js" | "whatsapp.js" | "formatter.js";
  exportName: string;
  category: string;
  description: string;
  riskLevel: "low" | "medium" | "high";
  testable: boolean;
};

export type AletaBotQuery = {
  id: string;
  name: string;
  category: AletaBotQueryCategory;
  description: string;
  sqlText: string;
  outputColumns: string[];
  recipientColumn: string;
  isActive: boolean;
  usedByNotifications: string[];
  lastTestedAt: string | null;
  lastTestStatus: "idle" | "success" | "failed";
  lastTestError: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AletaBotNotification = {
  id: string;
  name: string;
  category: AletaBotNotificationCategory;
  description: string;
  queryId: string;
  templateId: string;
  recipientSource: "users" | "query";
  recipientMapping: Record<string, unknown>;
  scheduleConfig: {
    type: "cron" | "manual" | "event";
    cron: string;
    trigger: string;
  };
  isActive: boolean;
  delayMs: number;
  retryLimit: number;
  lastRunAt: string | null;
  lastStatus: "idle" | "success" | "failed" | "simulated";
  lastMessage: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AletaBotEmployeeRecipient = {
  id: string;
  name: string;
  username: string;
  roleId: string;
  positionId: string;
  positionName: string;
  whatsappNumber: string;
  whatsappChatId: string;
};

export type AletaBotNotificationLogEntry = {
  id: string;
  notificationId: string | null;
  queryId: string | null;
  recipientNumber: string;
  recipientName: string;
  category: AletaBotNotificationCategory | "system";
  messagePreview: string;
  status: "success" | "failed" | "simulated";
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
};

export type AletaBotLogEntry = {
  id: string;
  level: AletaBotLogLevel;
  eventType: AletaBotLogType;
  message: string;
  metadata: Record<string, unknown>;
  actorUserId: string | null;
  createdAt: string;
};

export type AletaBotSnapshot = {
  settings: AletaBotSettings;
  runtimeState: AletaBotRuntimeState;
  whatsapp: {
    runtimeStatus: string;
    internalStatus: string;
    qrCode: string | null;
    linked: boolean;
    phoneNumber: string;
    sessionName: string;
    savedStatus: string;
    lastConnectedAt: string | null;
    lastErrorMessage: string | null;
  };
  metrics: {
    sentToday: number;
    failedToday: number;
    lastNotificationAt: string | null;
    activeJobs: number;
    enabledTemplates: number;
  };
  templates: AletaBotTemplate[];
  jobs: AletaBotJob[];
  notifications: AletaBotNotification[];
  queries: AletaBotQuery[];
  employeeRecipients: AletaBotEmployeeRecipient[];
  notificationLogs: AletaBotNotificationLogEntry[];
  queryCatalog: AletaBotQueryCatalogItem[];
  logs: AletaBotLogEntry[];
};
