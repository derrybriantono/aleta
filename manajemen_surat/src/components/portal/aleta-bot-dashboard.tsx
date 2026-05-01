"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  Eye,
  Filter,
  Loader2,
  MessageCircle,
  Search,
  Settings,
  Wifi,
  WifiOff,
  XCircle,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePortal } from "@/lib/app-state";
import { getEffectiveRoleId } from "@/lib/permissions";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type BotStatusData = {
  whatsapp: {
    status: string;
    statusLabel: string;
    connected: boolean;
    runtime: string;
    lastConnectedAt: string | null;
    lastErrorMessage: string | null;
    sessionStartedAt?: string | null;
    lastMessageSentAt?: string | null;
    sessionAgeHours?: number | null;
    authFailureCount?: number;
  };
  queue: {
    pending: number;
    processing: number;
    sentToday: number;
    failedToday: number;
    deadLetters: number;
  };
  worker: {
    status: string;
    statusLabel: string;
    lastHeartbeatAt: string | null;
  };
  ai: { status: string; statusLabel: string };
  service: { status: string; statusLabel: string };
  runtimeOnline: boolean;
  fetchedAt: string;
};

type MessageItem = {
  id: string;
  recipientName: string;
  recipientNumber: string;
  recipientNumberMasked: boolean;
  caseOrPosition: string;
  messagePreview: string;
  messageBody: string | null;
  status: string;
  statusLabel: string;
  sourceFeature: string;
  sourceFeatureLabel: string;
  sourceApp: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
  sentAt: string | null;
  errorMessage: string | null;
};

type MessagesData = {
  items: MessageItem[];
  total: number;
  limit: number;
  offset: number;
  filters?: {
    sourceFeature?: string | null;
    sourceApp?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    entityFilterApplied?: boolean;
    entityFilterFallback?: boolean;
  };
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDt(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 16).replace("T", " ");
  }
}

// ─── Status card sub-components ──────────────────────────────────────────────

function StatusBadge({ status, label }: { status: string; label: string }) {
  const map: Record<string, string> = {
    connected: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
    active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
    ready: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
    normal: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
    paused: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
    needs_sync: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
    needs_attention: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
    qr_needed: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
    initializing: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
    error: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
    offline: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400",
    unknown: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400",
    disabled: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400",
    disconnected: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        map[status] ?? "bg-slate-100 text-slate-600"
      )}
    >
      {label}
    </span>
  );
}

function MetricCard({
  icon: Icon,
  title,
  value,
  sub,
}: {
  icon: React.ElementType;
  title: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-2 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="mt-0.5 text-2xl font-bold text-foreground">{value}</p>
          {sub ? <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p> : null}
        </div>
      </div>
    </div>
  );
}

// ─── Message status badge ─────────────────────────────────────────────────────

function MsgStatusBadge({ status, label }: { status: string; label: string }) {
  const ok = status === "success" || status === "sent";
  const fail = status === "failed" || status === "dead_letter";
  return (
    <Badge
      variant={ok ? "default" : fail ? "danger" : "muted"}
      className="whitespace-nowrap text-xs"
    >
      {label}
    </Badge>
  );
}

// ─── Message detail modal ─────────────────────────────────────────────────────

function MessageDetail({
  item,
  onClose,
}: {
  item: MessageItem;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 px-4 pb-6 sm:items-center">
      <div className="w-full max-w-lg rounded-[1.8rem] border border-border bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="text-base font-bold text-foreground">Detail Pesan</h3>
          <Button variant="ghost" size="icon" className="shrink-0" onClick={onClose}>
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
        <dl className="space-y-3 text-sm">
          <Row label="Penerima" value={item.recipientName} />
          <Row
            label="Nomor WhatsApp"
            value={
              item.recipientNumber +
              (item.recipientNumberMasked ? " (disembunyikan)" : "")
            }
          />
          <Row label="Nomor Perkara / Jabatan" value={item.caseOrPosition} />
          <Row label="Sumber" value={item.sourceFeatureLabel} />
          <Row label="Status" value={<MsgStatusBadge status={item.status} label={item.statusLabel} />} />
          <Row label="Dibuat" value={formatDt(item.createdAt)} />
          {item.sentAt ? <Row label="Dikirim" value={formatDt(item.sentAt)} /> : null}
          {item.errorMessage ? (
            <Row
              label="Keterangan Gagal"
              value={<span className="text-destructive">{item.errorMessage}</span>}
            />
          ) : null}
          {item.messageBody ? (
            <div>
              <dt className="mb-1 text-xs font-medium text-muted-foreground">Isi Pesan</dt>
              <dd className="rounded-xl border border-border bg-muted/40 p-3 text-sm leading-7 whitespace-pre-wrap break-words">
                {item.messageBody}
              </dd>
            </div>
          ) : (
            <div>
              <dt className="mb-1 text-xs font-medium text-muted-foreground">Preview Pesan</dt>
              <dd className="rounded-xl border border-border bg-muted/40 p-3 text-sm leading-7 break-words">
                {item.messagePreview}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="min-w-[160px] text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-foreground">{value}</dd>
    </div>
  );
}

// ─── Status Tab ───────────────────────────────────────────────────────────────

function StatusTab({ data, loading }: { data: BotStatusData | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-[1.8rem] border border-border/80 bg-card p-8 text-center">
        <WifiOff className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">Gagal memuat status layanan.</p>
      </div>
    );
  }

  const waConnected = data.whatsapp.connected;

  return (
    <div className="space-y-6">
      {/* Service overview */}
      <Card className="border-border/80">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Status Layanan</CardTitle>
            <StatusBadge status={data.service.status} label={data.service.statusLabel} />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {data.service.status === "normal"
              ? "Semua layanan utama ALETA Bot dapat dipantau dan beroperasi normal."
              : "Satu atau lebih layanan ALETA Bot perlu perhatian. Hubungi Super Admin jika masalah berlanjut."}
          </p>
        </CardContent>
      </Card>

      {/* WhatsApp */}
      <Card className="border-border/80">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            {waConnected ? (
              <Wifi className="h-4 w-4 text-emerald-600" />
            ) : (
              <WifiOff className="h-4 w-4 text-rose-500" />
            )}
            <CardTitle className="text-base">WhatsApp</CardTitle>
            <StatusBadge status={data.whatsapp.status} label={data.whatsapp.statusLabel} />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Runtime</p>
              <p className="mt-0.5 text-sm font-semibold">{data.whatsapp.runtime}</p>
            </div>
            {data.whatsapp.lastConnectedAt ? (
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Terakhir Terhubung</p>
                <p className="mt-0.5 text-sm font-semibold">{formatDt(data.whatsapp.lastConnectedAt)}</p>
              </div>
            ) : null}
            {data.whatsapp.sessionAgeHours != null ? (
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Umur Sesi</p>
                <p className="mt-0.5 text-sm font-semibold">{data.whatsapp.sessionAgeHours} jam</p>
              </div>
            ) : null}
            {data.whatsapp.lastMessageSentAt ? (
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Kirim Terakhir</p>
                <p className="mt-0.5 text-sm font-semibold">{formatDt(data.whatsapp.lastMessageSentAt)}</p>
              </div>
            ) : null}
          </div>
          {(data.whatsapp.sessionAgeHours ?? 0) > 168 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 dark:border-amber-500/20 dark:bg-amber-500/10">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Sesi WhatsApp sudah aktif lebih dari 7 hari. Pantau pengiriman dan lakukan reconnect aman jika diperlukan.
              </p>
            </div>
          ) : null}
          {!waConnected ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 dark:border-amber-500/20 dark:bg-amber-500/10">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {data.whatsapp.status === "qr_needed"
                  ? "WhatsApp Bot menunggu scan QR. Hubungi Super Admin untuk menghubungkan ulang."
                  : "WhatsApp Bot belum terhubung. Hubungi Super Admin untuk informasi lebih lanjut."}
              </p>
              {data.whatsapp.lastErrorMessage ? (
                <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-300/70">
                  Keterangan: {data.whatsapp.lastErrorMessage}
                </p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Queue + Worker metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard
          icon={Clock}
          title="Antrean Pesan"
          value={data.queue.pending}
          sub="menunggu"
        />
        <MetricCard
          icon={Zap}
          title="Pesan Terkirim Hari Ini"
          value={data.queue.sentToday}
        />
        <MetricCard
          icon={XCircle}
          title="Pesan Gagal"
          value={data.queue.failedToday}
          sub="hari ini"
        />
        <MetricCard
          icon={AlertCircle}
          title="Gagal Permanen"
          value={data.queue.deadLetters}
          sub="perlu ditinjau"
        />
      </div>

      {/* Worker + AI in a row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="border-border/80">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Pemroses Antrean</CardTitle>
              <StatusBadge status={data.worker.status} label={data.worker.statusLabel} />
            </div>
          </CardHeader>
          <CardContent>
            {data.worker.lastHeartbeatAt ? (
              <p className="text-xs text-muted-foreground">
                Heartbeat: {formatDt(data.worker.lastHeartbeatAt)}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Tidak ada data heartbeat saat ini.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">AI Asisten Publik</CardTitle>
              <StatusBadge status={data.ai.status} label={data.ai.statusLabel} />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {data.ai.status === "ready"
                ? "Layanan AI untuk menjawab pertanyaan publik aktif."
                : data.ai.status === "needs_sync"
                ? "Konfigurasi AI perlu disinkronkan ulang oleh Super Admin."
                : data.ai.status === "disabled"
                ? "Layanan AI Public Q&A sedang dinonaktifkan."
                : "Status layanan AI tidak dapat ditentukan saat ini."}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Messages Tab ─────────────────────────────────────────────────────────────

const DATE_OPTIONS = [
  { value: "today", label: "Hari Ini" },
  { value: "7d", label: "7 Hari" },
  { value: "30d", label: "30 Hari" },
  { value: "", label: "Semua" },
];

const STATUS_OPTIONS = [
  { value: "", label: "Semua Status" },
  { value: "success", label: "Terkirim" },
  { value: "failed", label: "Gagal" },
  { value: "simulated", label: "Simulasi" },
  { value: "dead_letter", label: "Gagal Permanen" },
];

const SOURCE_FEATURE_OPTIONS = [
  { value: "", label: "Semua Sumber" },
  { value: "disposition", label: "Disposisi" },
  { value: "letter", label: "Surat" },
  { value: "employee", label: "Notifikasi Pegawai" },
  { value: "party", label: "Notifikasi Pihak" },
  { value: "public_qa", label: "Public Q&A" },
  { value: "system", label: "Sistem" },
  { value: "manajemen_surat", label: "Manajemen Surat" },
  { value: "jadwal_sidang", label: "Jadwal Sidang" },
  { value: "notifikasi_perkara", label: "Notifikasi Perkara" },
];

function MessagesTab() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<MessagesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFeatureFilter, setSourceFeatureFilter] = useState(searchParams.get("sourceFeature") ?? "");
  const [sourceAppFilter, setSourceAppFilter] = useState(searchParams.get("sourceApp") ?? "");
  const [entityTypeFilter, setEntityTypeFilter] = useState(searchParams.get("entityType") ?? "");
  const [entityIdFilter, setEntityIdFilter] = useState(searchParams.get("entityId") ?? "");
  const [dateRange, setDateRange] = useState("7d");
  const [offset, setOffset] = useState(0);
  const [selectedItem, setSelectedItem] = useState<MessageItem | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (sourceFeatureFilter) params.set("sourceFeature", sourceFeatureFilter);
      if (sourceAppFilter) params.set("sourceApp", sourceAppFilter);
      if (entityTypeFilter) params.set("entityType", entityTypeFilter);
      if (entityIdFilter) params.set("entityId", entityIdFilter);
      if (dateRange) params.set("dateRange", dateRange);
      params.set("limit", "50");
      params.set("offset", String(offset));
      const res = await fetch(`/api/aleta-bot/messages?${params.toString()}`);
      if (!res.ok) throw new Error("Gagal memuat riwayat pesan.");
      const json = await res.json() as { ok: boolean; data: MessagesData };
      if (!json.ok) throw new Error("Gagal memuat riwayat pesan.");
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat riwayat pesan.");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, sourceFeatureFilter, sourceAppFilter, entityTypeFilter, entityIdFilter, dateRange, offset]);

  const exportCsv = () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    if (sourceFeatureFilter) params.set("sourceFeature", sourceFeatureFilter);
    if (sourceAppFilter) params.set("sourceApp", sourceAppFilter);
    if (entityTypeFilter) params.set("entityType", entityTypeFilter);
    if (entityIdFilter) params.set("entityId", entityIdFilter);
    if (dateRange) params.set("dateRange", dateRange);
    params.set("format", "csv");
    params.set("limit", "1000");
    window.open(`/api/aleta-bot/messages?${params.toString()}`, "_blank", "noopener,noreferrer");
  };

  const clearEntityFilter = () => {
    setEntityIdFilter("");
    setEntityTypeFilter("");
    setSourceAppFilter("");
    setSourceFeatureFilter("");
    setOffset(0);
  };

  useEffect(() => {
    void fetchMessages();
  }, [fetchMessages]);

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="rounded-[1.4rem] border border-border/80 bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
              placeholder="Cari nama atau nomor..."
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters((v) => !v)}
            className="gap-1.5"
          >
            <Filter className="h-3.5 w-3.5" />
            Filter
            {showFilters ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void fetchMessages()} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Muat Ulang"}
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>

        {showFilters && (
          <div className="mt-3 flex flex-wrap gap-3 border-t border-border pt-3">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Status</p>
              <div className="flex flex-wrap gap-1.5">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setStatusFilter(opt.value); setOffset(0); }}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition",
                      statusFilter === opt.value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:bg-muted"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Rentang Waktu</p>
              <div className="flex flex-wrap gap-1.5">
                {DATE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setDateRange(opt.value); setOffset(0); }}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition",
                      dateRange === opt.value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:bg-muted"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Sumber Fitur</p>
              <div className="flex flex-wrap gap-1.5">
                {SOURCE_FEATURE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setSourceFeatureFilter(opt.value); setOffset(0); }}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition",
                      sourceFeatureFilter === opt.value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:bg-muted"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {entityIdFilter ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-foreground">
            <Badge variant="outline">Filter surat/disposisi aktif</Badge>
            <span className="break-all">
              {sourceFeatureFilter || "riwayat"} / {entityTypeFilter || "entity"} / {entityIdFilter}
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={clearEntityFilter} className="h-7 rounded-lg text-xs">
              Hapus Filter
            </Button>
          </div>
        ) : null}
      </div>

      {/* Error */}
      {error ? (
        <div className="rounded-[1.4rem] border border-destructive/30 bg-destructive/5 p-5">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      ) : null}

      {/* Loading skeleton */}
      {loading && !data ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : null}

      {/* Empty */}
      {!loading && data && data.items.length === 0 ? (
        <div className="rounded-[1.8rem] border border-border/80 bg-card py-12 text-center">
          <MessageCircle className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">
            {entityIdFilter
              ? "Belum ada riwayat pesan untuk surat/disposisi ini."
              : "Tidak ada riwayat pengiriman pesan untuk filter yang dipilih."}
          </p>
          {data.filters?.entityFilterFallback ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Filter entity sudah diterapkan. Jika log lama belum menyimpan entityId, gunakan filter sumber fitur sebagai fallback.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Cards list — responsive, no horizontal scroll */}
      {data && data.items.length > 0 ? (
        <div className="space-y-3">
          {data.items.map((item) => (
            <div
              key={item.id}
              className="rounded-[1.4rem] border border-border/80 bg-card p-4 transition hover:shadow-sm"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                {/* Left: identity */}
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground truncate">
                      {item.recipientName}
                    </span>
                    <MsgStatusBadge status={item.status} label={item.statusLabel} />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="whitespace-nowrap">
                      {item.recipientNumber}
                      {item.recipientNumberMasked ? (
                        <span className="ml-1 opacity-60">(tersembunyi)</span>
                      ) : null}
                    </span>
                    <span className="whitespace-nowrap">
                      Perkara/Jabatan:{" "}
                      <strong className="font-medium text-foreground">{item.caseOrPosition}</strong>
                    </span>
                    <span className="whitespace-nowrap">
                      Sumber: <strong className="font-medium text-foreground">{item.sourceFeatureLabel}</strong>
                    </span>
                  </div>
                  <p className="line-clamp-2 text-sm text-muted-foreground break-words">
                    {item.messagePreview}
                  </p>
                  {item.errorMessage ? (
                    <p className="text-xs text-destructive">↳ {item.errorMessage}</p>
                  ) : null}
                </div>

                {/* Right: time + action */}
                <div className="flex shrink-0 flex-row items-center gap-3 sm:flex-col sm:items-end">
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDt(item.sentAt ?? item.createdAt)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 rounded-xl text-xs"
                    onClick={() => setSelectedItem(item)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Detail
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Pagination */}
      {data && (data.total > data.limit) ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            {offset + 1}–{Math.min(offset + data.limit, data.total)} dari {data.total} pesan
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOffset(Math.max(0, offset - data.limit))}
              disabled={offset === 0}
            >
              Sebelumnya
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOffset(offset + data.limit)}
              disabled={offset + data.limit >= data.total}
            >
              Berikutnya
            </Button>
          </div>
        </div>
      ) : null}

      {/* Detail modal */}
      {selectedItem ? (
        <MessageDetail item={selectedItem} onClose={() => setSelectedItem(null)} />
      ) : null}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AletaBotDashboard() {
  const searchParams = useSearchParams();
  const { currentUser } = usePortal();
  const roleId = getEffectiveRoleId(currentUser);
  const isSuperAdmin = roleId === "super-admin";

  const [statusData, setStatusData] = useState<BotStatusData | null>(null);
  const [statusLoading, setStatusLoading] = useState(true); // starts true; cleared in effect

  useEffect(() => {
    let cancelled = false;
    fetch("/api/aleta-bot/status")
      .then((r) => r.json() as Promise<{ ok: boolean; data: BotStatusData }>)
      .then((j) => {
        if (!cancelled && j.ok) setStatusData(j.data);
      })
      .catch(() => {
        // Fail silently — dashboard shows offline state
      })
      .finally(() => {
        if (!cancelled) setStatusLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Bot Notifikasi"
        title="ALETA Bot"
        description="Pantau status layanan WhatsApp Bot, antrean pesan, dan riwayat pengiriman notifikasi."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/portal">
                <ArrowLeft className="h-4 w-4" />
                Kembali ke Portal Utama
              </Link>
            </Button>
            {isSuperAdmin ? (
              <Button asChild variant="default" size="sm">
                <Link href="/admin/aleta-bot">
                  <Settings className="h-4 w-4" />
                  Pengaturan Admin ALETA Bot
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      {!isSuperAdmin ? (
        <div className="rounded-[1.4rem] border border-border/60 bg-muted/30 px-4 py-3">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
            Pengaturan teknis hanya tersedia untuk Super Admin. Data ditampilkan sesuai hak akses Anda.
          </p>
        </div>
      ) : null}

      {statusData && !statusData.whatsapp.connected ? (
        <div className="rounded-[1.4rem] border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">WhatsApp Bot belum terhubung.</p>
          <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-200/80">
            Pesan akan menunggu di antrean sampai koneksi aktif kembali.
            {statusData.whatsapp.lastConnectedAt ? ` Terakhir terhubung: ${formatDt(statusData.whatsapp.lastConnectedAt)}.` : ""}
          </p>
        </div>
      ) : null}

      <Tabs defaultValue={["riwayat", "riwayat-pengiriman"].includes(searchParams.get("tab") ?? "") ? "riwayat" : "status"}>
        <TabsList className="mb-2">
          <TabsTrigger value="status">Status Bot</TabsTrigger>
          <TabsTrigger value="riwayat">Riwayat Pengiriman Pesan</TabsTrigger>
        </TabsList>

        <TabsContent value="status">
          <StatusTab data={statusData} loading={statusLoading} />
        </TabsContent>

        <TabsContent value="riwayat">
          <MessagesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
