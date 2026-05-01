"use client";

import { useCallback, useEffect, useState } from "react";

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

export function getWhatsAppRuntimeMessage(status: WhatsAppGatewayRuntimeStatus) {
  if (status === "waiting_qr") return "QR siap dipindai";
  if (status === "initializing") return "Sedang menyiapkan sesi WhatsApp Web";
  if (status === "connected") return "WhatsApp kantor sudah tertaut";
  if (status === "failed") return "Inisialisasi WhatsApp gagal";
  return "Sesi WhatsApp belum diinisialisasi";
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
        throw new Error(payload?.error?.message ?? "Status WhatsApp gateway tidak dapat dibaca.");
      }

      setSnapshot(payload.data);
      if (payload.data.linked) {
        setFeedback("WhatsApp kantor sudah tertaut dan siap digunakan untuk notifikasi.");
      }
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Status WhatsApp gateway tidak dapat dibaca.");
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
        throw new Error(payload?.error?.message ?? "Inisialisasi WhatsApp gagal diproses.");
      }

      setFeedback(payload.data?.message ?? "Inisialisasi WhatsApp dimulai.");
      await refresh();
      return true;
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Inisialisasi WhatsApp gagal diproses.");
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
        throw new Error(payload?.error?.message ?? "Penonaktifan WhatsApp gagal diproses.");
      }

      if (payload.data?.snapshot) {
        setSnapshot(payload.data.snapshot);
      } else {
        await refresh();
      }

      setFeedback(
        payload.data?.message ??
          "Sesi WhatsApp gateway berhasil dinonaktifkan dari runtime aktif."
      );
      return true;
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Penonaktifan WhatsApp gagal diproses.");
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
