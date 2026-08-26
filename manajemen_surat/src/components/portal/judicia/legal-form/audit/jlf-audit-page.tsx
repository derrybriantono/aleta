"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Filter, RefreshCw, ShieldCheck } from "lucide-react";

import { AccessDeniedCard, EmptyState, PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { usePortal } from "@/lib/app-state";
import { apiPath } from "@/lib/base-path";
import {
  hasJudiciaLegalFormPermission,
  JLF_PERMISSION,
  JUDICIA_LEGAL_FORM_ROUTE,
  resolveJudiciaLegalFormAccess,
} from "@/lib/judicia-legal-form-types";
import { getEffectiveRoleId, getUserPositionLabel } from "@/lib/permissions";

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { message?: string };
};

type AuditLogItem = {
  id: string;
  userId: string | null;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  nomorPerkara: string;
  metadata: unknown;
  createdAt: string;
};

type AuditResponse = {
  items: AuditLogItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
};

async function readApi<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error?.message ?? "Permintaan audit JLF belum berhasil.");
  }
  return payload?.data as T;
}

function eventVariant(action: string) {
  if (action.includes("reject") || action.includes("failed")) return "danger";
  if (action.includes("approve") || action.includes("finalize") || action.includes("verify")) return "success";
  if (action.includes("ai") || action.includes("anonymizer")) return "warning";
  return "outline";
}

function safeMetadataPreview(metadata: unknown) {
  const text = JSON.stringify(metadata ?? {}, null, 2);
  return text.length > 800 ? `${text.slice(0, 800)}\n...` : text;
}

export function JlfAuditPage() {
  const { currentUser, positions } = usePortal();
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [filters, setFilters] = useState({
    userId: "",
    action: "",
    entityType: "",
    nomorPerkara: "",
    from: "",
    to: "",
    eventGroup: "",
  });
  const effectiveRoleId = getEffectiveRoleId(currentUser);
  const currentPositionLabel = getUserPositionLabel(currentUser, positions);
  const access = resolveJudiciaLegalFormAccess(currentUser, {
    effectiveRoleId,
    positionLabel: currentPositionLabel,
  });
  const canViewAudit = hasJudiciaLegalFormPermission(access, JLF_PERMISSION.AUDIT_VIEW);

  const loadAudit = useCallback(async () => {
    if (!canViewAudit) return;
    setBusy(true);
    setMessage("");
    try {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(filters)) {
        if (value) params.set(key, value);
      }
      params.set("limit", "50");
      const result = await readApi<AuditResponse>(
        await fetch(apiPath(`/api/judicia/legal-form/audit?${params.toString()}`), {
          cache: "no-store",
          credentials: "include",
        })
      );
      setItems(result.items ?? []);
      setTotal(result.pagination.total ?? 0);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat audit trail JLF.");
    } finally {
      setBusy(false);
    }
  }, [canViewAudit, filters]);

  useEffect(() => {
    if (!canViewAudit) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) void loadAudit();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [canViewAudit, loadAudit]);

  if (!currentUser) {
    return (
      <Card className="border-border/80">
        <CardContent className="p-6 text-sm text-muted-foreground">Memuat sesi portal...</CardContent>
      </Card>
    );
  }

  if (!canViewAudit) {
    return <AccessDeniedCard />;
  }

  return (
    <div className="space-y-8">
      <PageIntro
        eyebrow="Judicia Legal Form"
        title="Audit Trail JLF"
        description="Jejak aktivitas penting JLF dengan metadata yang disamarkan untuk token, secret, raw input, dan payload sensitif."
        actions={
          <Button asChild variant="outline">
            <Link href={JUDICIA_LEGAL_FORM_ROUTE}>Dashboard JLF</Link>
          </Button>
        }
      />

      <Card className="border-border/80">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-primary" />
                Filter Audit
              </CardTitle>
              <CardDescription>Filter user, action, entity, nomor perkara, tanggal, dan kelompok event.</CardDescription>
            </div>
            <Badge variant="outline">{total} log</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-4">
            <Input value={filters.userId} onChange={(event) => setFilters((current) => ({ ...current, userId: event.target.value }))} placeholder="User ID" />
            <Input value={filters.action} onChange={(event) => setFilters((current) => ({ ...current, action: event.target.value }))} placeholder="Action" />
            <Input value={filters.entityType} onChange={(event) => setFilters((current) => ({ ...current, entityType: event.target.value }))} placeholder="Entity type" />
            <Input value={filters.nomorPerkara} onChange={(event) => setFilters((current) => ({ ...current, nomorPerkara: event.target.value }))} placeholder="Nomor perkara" />
            <Input type="date" value={filters.from} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} />
            <Input type="date" value={filters.to} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} />
            <NativeSelect value={filters.eventGroup} onChange={(event) => setFilters((current) => ({ ...current, eventGroup: event.target.value }))}>
              <option value="">Semua event</option>
              <option value="ai">AI event</option>
              <option value="account_sync">Account sync</option>
              <option value="document">Document event</option>
              <option value="whatsapp">WhatsApp event</option>
              <option value="regulation">Regulation event</option>
              <option value="template">Template event</option>
              <option value="variable">Variable event</option>
              <option value="anonymizer">Anonymizer event</option>
            </NativeSelect>
            <Button type="button" variant="outline" disabled={busy} onClick={loadAudit}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        </CardContent>
      </Card>

      {items.length === 0 ? (
        <EmptyState title="Belum ada audit log yang sesuai" description="Ubah filter atau jalankan aktivitas JLF untuk melihat jejak audit." />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id} className="border-border/80">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      {item.action}
                      <Badge variant={eventVariant(item.action)}>{item.entityType}</Badge>
                    </CardTitle>
                    <CardDescription>
                      {item.userName || item.userId || "System"} - {item.createdAt}
                      {item.nomorPerkara ? ` - ${item.nomorPerkara}` : ""}
                    </CardDescription>
                  </div>
                  <Badge variant="outline">{item.entityId || "-"}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="max-h-56 overflow-auto rounded-xl border border-border/80 bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
                  {safeMetadataPreview(item.metadata)}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
