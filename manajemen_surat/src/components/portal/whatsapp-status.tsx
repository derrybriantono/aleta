"use client";

import { MessageCircleMore, RefreshCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { type WhatsAppDelivery } from "@/lib/types";
import { cn } from "@/lib/utils";

export function WhatsAppStatusStack({
  deliveries,
  onRetry,
  compact,
  showFullNumber,
}: {
  deliveries: WhatsAppDelivery[];
  onRetry?: (deliveryId: string) => void;
  compact?: boolean;
  showFullNumber?: boolean;
}) {
  if (deliveries.length === 0) {
    return <p className="text-xs text-muted-foreground">Belum ada notifikasi WhatsApp.</p>;
  }

  return (
    <div className="space-y-2">
      {deliveries.map((delivery) => (
        <div
          key={delivery.id}
          className={cn(
            "rounded-[1rem] border border-border bg-card/80 px-3 py-2",
            compact && "border-0 bg-transparent px-0 py-0"
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{delivery.recipientName}</p>
              <p className="text-xs text-muted-foreground">
                {showFullNumber ? delivery.recipientWhatsapp : maskPhoneNumber(delivery.recipientWhatsapp)}
              </p>
              {delivery.sourceFeature ? (
                <p className="mt-0.5 text-[11px] text-muted-foreground">{delivery.sourceFeature}</p>
              ) : null}
            </div>
            {delivery.status === "Gagal" ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto px-2 py-1 text-amber-700 hover:text-amber-800 dark:text-amber-200"
                onClick={() => onRetry?.(delivery.id)}
            >
              <RefreshCcw className="h-3.5 w-3.5" />
                Coba kirim ulang
            </Button>
            ) : (
              <Badge variant="success">Terkirim</Badge>
            )}
          </div>
          {!compact ? (
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <MessageCircleMore className="h-3.5 w-3.5" />
              <span>{formatDateTime(delivery.lastAttemptAt)}</span>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function maskPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 6) return value;
  return `${digits.slice(0, 4)}****${digits.slice(-3)}`;
}
