"use client";

import { useCallback, useEffect, useState } from "react";

import { humanizeErrorMessage, humanizeStatus } from "@/lib/humanized-labels";

export type WhatsAppGatewayRuntimeStatus =
  | "disconnected"
  | "initializing"
  | "waiting_qr"
  | "connected"
  | "failed";

export type WhatsAppGatewaySnapshot = {
  runtimeStatus: WhatsAppGatewayRuntimeStatus;
  internalStatus: "inactive" | "initializing" | "qr" | "authenticated" | "ready" | "failed";
  qrCode: string | null;
  linked: boolean;
  phoneNumber: string;
  sessionName: string;
  savedStatus: "active" | "inactive" | "failed";
  lastConnectedAt: string | null;
  requiresPhoneNumberBeforeInit: boolean;
  lastErrorMessage: string | null;
};

const defaultSnapshot: WhatsAppGatewaySnapshot = {
  runtimeStatus: "disconnected",
  internalStatus: "inactive",
  qrCode: null,
  linked: false,
  phoneNumber: "",
  sessionName: "aleta-session",
  savedStatus: "inactive",
  lastConnectedAt: null,
  requiresPhoneNumberBeforeInit: false,
  lastErrorMessage: null,
};

export function getWhatsAppRuntimeLabel(status: WhatsAppGatewayRuntimeStatus) {
  if (status === "connected") return "connected";
  if (status === "waiting_qr") return "waiting_qr";
  if (status === "initializing") return "initializing";
  if (status === "failed") return "failed";
  return "disconnected";
}

export function getWhatsAppRuntimeDisplayLabel(status: WhatsAppGatewayRuntimeStatus) {
  return humanizeStatus(getWhatsAppRuntimeLabel(status));
}

export function getWhatsAppRuntimeMessage(status: WhatsAppGatewayRuntimeStatus) {
  if (status === "waiting_qr") return "QR sudah tersedia di pusat koneksi WhatsApp.";
  if (status === "initializing") return "Layanan WhatsApp sedang menyiapkan koneksi.";
  if (status === "connected") return "Layanan WhatsApp kantor sudah terhubung.";
  if (status === "failed") return "Koneksi WhatsApp belum berhasil. Periksa pusat koneksi.";
  return "Layanan WhatsApp belum terhubung.";
}

export function useWhatsAppGateway(canAccess: boolean) {
  const [snapshot, setSnapshot] = useState<WhatsAppGatewaySnapshot>(defaultSnapshot);
  const [feedback, setFeedback] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const refresh = useCallback(async () => {
    if (!canAccess) return;

    setIsRefreshing(true);
    try {
      const response = await fetch("/api/whatsapp/status", {
        credentials: "include",
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            data?: WhatsAppGatewaySnapshot;
            error?: { message?: string };
          }
        | null;

      if (!response.ok || !payload?.ok || !payload.data) {
        throw new Error(humanizeErrorMessage(payload?.error?.message, "Status WhatsApp belum dapat dibaca."));
      }

      setSnapshot(payload.data);
      if (payload.data.linked) {
        setFeedback("WhatsApp kantor sudah terhubung dan siap dipantau.");
      }
    } catch (error) {
      setFeedback(error instanceof Error ? humanizeErrorMessage(error.message) : "Status WhatsApp belum dapat dibaca.");
    } finally {
      setIsRefreshing(false);
    }
  }, [canAccess]);

  const initialize = async () => {
    if (!canAccess) return false;

    setIsInitializing(true);
    setFeedback("");

    try {
      const response = await fetch("/api/whatsapp/init", {
        method: "POST",
        credentials: "include",
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            data?: { message?: string };
            error?: { message?: string };
          }
        | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(humanizeErrorMessage(payload?.error?.message, "Koneksi WhatsApp belum dapat dimulai."));
      }

      setFeedback(humanizeErrorMessage(payload.data?.message, "Koneksi WhatsApp sedang disiapkan."));
      await refresh();
      return true;
    } catch (error) {
      setFeedback(error instanceof Error ? humanizeErrorMessage(error.message) : "Koneksi WhatsApp belum dapat dimulai.");
      setSnapshot((current) => ({
        ...current,
        runtimeStatus: "failed",
      }));
      return false;
    } finally {
      setIsInitializing(false);
    }
  };

  const deactivate = async () => {
    if (!canAccess) return false;

    setIsDeactivating(true);
    setFeedback("");

    try {
      const response = await fetch("/api/whatsapp/deactivate", {
        method: "POST",
        credentials: "include",
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            data?: { message?: string; snapshot?: WhatsAppGatewaySnapshot };
            error?: { message?: string };
          }
        | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(humanizeErrorMessage(payload?.error?.message, "Layanan WhatsApp belum dapat dinonaktifkan."));
      }

      if (payload.data?.snapshot) {
        setSnapshot(payload.data.snapshot);
      } else {
        await refresh();
      }

      setFeedback(
        payload.data?.message ??
          "Layanan WhatsApp berhasil dinonaktifkan dari sesi aktif."
      );
      return true;
    } catch (error) {
      setFeedback(error instanceof Error ? humanizeErrorMessage(error.message) : "Layanan WhatsApp belum dapat dinonaktifkan.");
      return false;
    } finally {
      setIsDeactivating(false);
    }
  };

  useEffect(() => {
    if (!canAccess) return;

    void refresh();
  }, [canAccess, refresh]);

  useEffect(() => {
    if (!canAccess) return;
    if (!["initializing", "waiting_qr"].includes(snapshot.runtimeStatus)) return;

    const timer = globalThis.setInterval(() => {
      void refresh().catch(() => undefined);
    }, 2500);

    return () => globalThis.clearInterval(timer);
  }, [canAccess, refresh, snapshot.runtimeStatus]);

  return {
    snapshot,
    feedback,
    setFeedback,
    refresh,
    initialize,
    deactivate,
    isRefreshing,
    isInitializing,
    isDeactivating,
  };
}
