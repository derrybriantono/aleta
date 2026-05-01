"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, RefreshCcw, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type AuditItem = {
  id: string;
  actorUserId: string | null;
  actorName: string;
  actorRoleId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

function formatActionLabel(action: string) {
  return action
    .split("_")
    .filter(Boolean)
    .map((chunk) => `${chunk.slice(0, 1)}${chunk.slice(1).toLowerCase()}`)
    .join(" ");
}

function summarizePayload(payload: Record<string, unknown>) {
  const entries = Object.entries(payload)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${String(value)}`);

  return entries.length > 0 ? entries.join(" | ") : "Tidak ada payload tambahan.";
}

export function AuditTrailBoard() {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAuditLogs = async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/audit?limit=200", {
        credentials: "include",
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; data?: { items?: AuditItem[] }; error?: { message?: string } }
        | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error?.message ?? "Audit trail tidak dapat dimuat.");
      }

      setItems(payload.data?.items ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Audit trail tidak dapat dimuat.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAuditLogs();
  }, []);

  return (
    <Card className="border-border/80">
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Audit Trail
          </CardTitle>
          <CardDescription>Log aktivitas konfigurasi dan operasi penting sistem untuk kebutuhan pengawasan super admin.</CardDescription>
        </div>
        <Button type="button" variant="outline" onClick={() => void loadAuditLogs()} disabled={isLoading}>
          {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          Muat Ulang
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <div className="rounded-[1.2rem] border border-rose-300/60 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-200">
            {error}
          </div>
        ) : null}

        {items.length === 0 && !isLoading ? (
          <div className="rounded-[1.2rem] border border-dashed border-border bg-muted/35 px-4 py-10 text-center text-sm text-muted-foreground">
            Belum ada audit log yang tercatat.
          </div>
        ) : null}

        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-[1.2rem] border border-border bg-card px-4 py-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-foreground">{formatActionLabel(item.action)}</p>
                    <Badge variant="outline">{item.entityType}</Badge>
                    {item.actorRoleId ? <Badge variant="muted">{item.actorRoleId}</Badge> : null}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {item.actorName} | {item.entityId}
                  </p>
                  <p className="text-sm leading-6 text-muted-foreground">{summarizePayload(item.payload)}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(item.createdAt).toLocaleString("id-ID")}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
