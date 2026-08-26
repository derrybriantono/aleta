import type { QueryResultRow } from "pg";

import type { AletaDatabase } from "@/server/db/client";
import {
  getGatewayWhatsappStatus,
  getWhatsappRuntimeMode,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";

type AletaBotSettingsRow = QueryResultRow & {
  bot_enabled: number;
  notifications_enabled: number;
  dry_run_enabled: number;
  last_status?: string | null;
};

type WhatsappSettingsRow = QueryResultRow & {
  session_name: string;
  status: string;
  last_connected_at: string | null;
};

export async function getAletaBotSettingsSummary(db: AletaDatabase) {
  const row = await db.prepare(
    `SELECT bot_enabled, notifications_enabled, dry_run_enabled
     FROM aleta_bot_settings
     WHERE id = 1`
  ).get<AletaBotSettingsRow>();

  return {
    botEnabled: Boolean(row?.bot_enabled),
    notificationsEnabled: Boolean(row?.notifications_enabled),
    dryRunEnabled: row ? Boolean(row.dry_run_enabled) : true,
    exposesToken: false,
  };
}

export async function getWhatsappGatewayStatus(db: AletaDatabase) {
  const runtimeMode = getWhatsappRuntimeMode();
  const portalSettings = await db.prepare(
    `SELECT session_name, status, last_connected_at
     FROM whatsapp_web_settings
     WHERE id = 1`
  ).get<WhatsappSettingsRow>();

  if (runtimeMode === "disabled") {
    return {
      runtimeMode,
      connected: false,
      status: "disabled",
      sessionName: portalSettings?.session_name ?? "ALETA WhatsApp Web",
      phoneNumber: "",
      displayName: "",
      lastConnectedAt: portalSettings?.last_connected_at ?? null,
      errorMessage: null,
      exposesToken: false,
    };
  }

  const gatewayResult = runtimeMode === "aleta_bot" ? await getGatewayWhatsappStatus() : null;

  if (gatewayResult?.ok) {
    return {
      runtimeMode,
      connected: gatewayResult.data.status === "connected",
      status: gatewayResult.data.status,
      sessionName: gatewayResult.data.sessionName,
      phoneNumber: gatewayResult.data.phoneNumber ? "tersedia" : "",
      displayName: gatewayResult.data.displayName,
      lastConnectedAt: gatewayResult.data.lastConnectedAt,
      errorMessage: gatewayResult.data.lastError,
      qrAvailable: gatewayResult.data.qrAvailable,
      gatewayMode: gatewayResult.data.gatewayMode,
      exposesToken: false,
    };
  }

  return {
    runtimeMode,
    connected: portalSettings?.status === "active",
    status: portalSettings?.status ?? "unknown",
    sessionName: portalSettings?.session_name ?? "ALETA WhatsApp Web",
    phoneNumber: "",
    displayName: "",
    lastConnectedAt: portalSettings?.last_connected_at ?? null,
    errorMessage: gatewayResult?.ok === false ? gatewayResult.error : null,
    exposesToken: false,
  };
}

export async function isWhatsappEnabled(db: AletaDatabase) {
  const [settings, gateway] = await Promise.all([
    getAletaBotSettingsSummary(db),
    getWhatsappGatewayStatus(db),
  ]);

  return settings.botEnabled && settings.notificationsEnabled && gateway.status !== "disabled";
}

export const JlfAletaBotStatusReader = {
  getWhatsappGatewayStatus,
  getAletaBotSettingsSummary,
  isWhatsappEnabled,
};
