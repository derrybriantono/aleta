"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, Filter, LoaderCircle, MessageSquareText, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AccessDeniedCard, PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { usePortal } from "@/lib/app-state";
import {
  FEEDBACK_APP_AREAS,
  FEEDBACK_APP_AREA_LABELS,
  FEEDBACK_PRIORITIES,
  FEEDBACK_PRIORITY_LABELS,
  FEEDBACK_STATUSES,
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_TYPES,
  FEEDBACK_TYPE_LABELS,
  getFeedbackPriorityVariant,
  getFeedbackStatusVariant,
  type FeedbackAppArea,
  type FeedbackPriority,
  type FeedbackRequest,
  type FeedbackStatus,
  type FeedbackType,
} from "@/lib/feedback";
import { formatDateTime } from "@/lib/format";
import { getEffectiveRoleId } from "@/lib/permissions";

type FeedbackAdminSummary = {
  total: number;
  new: number;
  openBugs: number;
  plannedFeatures: number;
  appIdeas: number;
};

type Filters = {
  type: "all" | FeedbackType;
  appArea: "all" | FeedbackAppArea;
  status: "all" | FeedbackStatus;
  priority: "all" | FeedbackPriority;
  search: string;
  reporter: string;
};

async function readApiJson<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; data?: T; error?: { message?: string } }
    | null;

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error?.message ?? "Permintaan tidak dapat diproses.");
  }

  return payload.data as T;
}

export function FeedbackAdminPanel() {
  const { currentUser, users } = usePortal();
  const roleId = getEffectiveRoleId(currentUser);
  const isAdmin = roleId === "super-admin" || roleId === "admin";
  const [items, setItems] = useState<FeedbackRequest[]>([]);
  const [summary, setSummary] = useState<FeedbackAdminSummary>({
    total: 0,
    new: 0,
    openBugs: 0,
    plannedFeatures: 0,
    appIdeas: 0,
  });
  const [filters, setFilters] = useState<Filters>({
    type: "all",
    appArea: "all",
    status: "all",
    priority: "all",
    search: "",
    reporter: "",
  });
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, {
    status: FeedbackStatus;
    adminNote: string;
    resolutionNote: string;
    assignedToUserId: string;
    duplicateOfId: string;
  }>>({});

  useEffect(() => {
    document.title = "Masukan Pengguna - ALETA";
  }, []);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.type !== "all") params.set("type", filters.type);
    if (filters.appArea !== "all") params.set("appArea", filters.appArea);
    if (filters.status !== "all") params.set("status", filters.status);
    if (filters.priority !== "all") params.set("priority", filters.priority);
    if (filters.search.trim()) params.set("search", filters.search.trim());
    if (filters.reporter.trim()) params.set("reporter", filters.reporter.trim());
    return params.toString();
  }, [filters]);

  async function loadFeedback() {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/feedback${queryString ? `?${queryString}` : ""}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await readApiJson<{ items: FeedbackRequest[]; summary: FeedbackAdminSummary }>(response);
      setItems(data.items ?? []);
      setSummary(data.summary);
      setDrafts(
        Object.fromEntries(
          (data.items ?? []).map((item) => [
            item.id,
            {
              status: item.status,
              adminNote: item.adminNote,
              resolutionNote: item.resolutionNote,
              assignedToUserId: item.assignedToUserId ?? "",
              duplicateOfId: item.duplicateOfId ?? "",
            },
          ])
        )
      );
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Masukan pengguna gagal dimuat.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isAdmin) return;
    void loadFeedback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  if (!isAdmin) {
    return <AccessDeniedCard />;
  }

  async function saveFeedback(item: FeedbackRequest) {
    const draft = drafts[item.id];
    if (!draft) return;
    setSavingId(item.id);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/feedback/${item.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          status: draft.status,
          adminNote: draft.adminNote,
          resolutionNote: draft.resolutionNote,
          assignedToUserId: draft.assignedToUserId || null,
          duplicateOfId: draft.duplicateOfId || null,
        }),
      });
      const data = await readApiJson<{ item: FeedbackRequest }>(response);
      setItems((current) => current.map((entry) => (entry.id === item.id ? data.item : entry)));
      setDrafts((current) => ({
        ...current,
        [item.id]: {
          status: data.item.status,
          adminNote: data.item.adminNote,
          resolutionNote: data.item.resolutionNote,
          assignedToUserId: data.item.assignedToUserId ?? "",
          duplicateOfId: data.item.duplicateOfId ?? "",
        },
      }));
      setMessage({ type: "success", text: "Status masukan berhasil diperbarui." });
      void loadFeedback();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Masukan gagal diperbarui.",
      });
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Masukan Pengguna"
        title="Laporan Bug dan Saran"
        description="Tinjau laporan bug, saran fitur, dan usulan aplikasi baru dari pengguna ALETA."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin">
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Pengaturan
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Total Masukan" value={summary.total} />
        <SummaryCard label="Masukan Baru" value={summary.new} />
        <SummaryCard label="Bug Terbuka" value={summary.openBugs} />
        <SummaryCard label="Fitur Direncanakan" value={summary.plannedFeatures} />
        <SummaryCard label="Aplikasi Diusulkan" value={summary.appIdeas} />
      </div>

      <Card className="border-border/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" />
            Filter Masukan
          </CardTitle>
          <CardDescription>Gunakan filter ringan agar admin tidak perlu membaca semua masukan sekaligus.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-6">
          <NativeSelect value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value as Filters["type"] }))}>
            <option value="all">Semua jenis</option>
            {FEEDBACK_TYPES.map((type) => (
              <option key={type.id} value={type.id}>{type.label}</option>
            ))}
          </NativeSelect>
          <NativeSelect value={filters.appArea} onChange={(event) => setFilters((current) => ({ ...current, appArea: event.target.value as Filters["appArea"] }))}>
            <option value="all">Semua aplikasi</option>
            {FEEDBACK_APP_AREAS.map((area) => (
              <option key={area.id} value={area.id}>{area.label}</option>
            ))}
          </NativeSelect>
          <NativeSelect value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as Filters["status"] }))}>
            <option value="all">Semua status</option>
            {FEEDBACK_STATUSES.map((status) => (
              <option key={status.id} value={status.id}>{status.label}</option>
            ))}
          </NativeSelect>
          <NativeSelect value={filters.priority} onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value as Filters["priority"] }))}>
            <option value="all">Semua prioritas</option>
            {FEEDBACK_PRIORITIES.map((priority) => (
              <option key={priority.id} value={priority.id}>{priority.label}</option>
            ))}
          </NativeSelect>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder="Cari judul/deskripsi"
              className="pl-9"
            />
          </div>
          <Button type="button" variant="outline" onClick={loadFeedback} disabled={loading}>
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Terapkan
          </Button>
        </CardContent>
      </Card>

      {message ? (
        <div className={`rounded-xl border px-4 py-3 text-sm ${message.type === "success" ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200" : "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200"}`}>
          {message.text}
        </div>
      ) : null}

      <div className="space-y-4">
        {loading ? (
          <Card className="border-border/80">
            <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Memuat masukan pengguna...
            </CardContent>
          </Card>
        ) : items.length === 0 ? (
          <Card className="border-dashed border-border bg-muted/30">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Belum ada masukan yang cocok dengan filter.
            </CardContent>
          </Card>
        ) : (
          items.map((item) => {
            const draft = drafts[item.id];
            return (
              <Card key={item.id} className="border-border/80">
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{FEEDBACK_TYPE_LABELS[item.type]}</Badge>
                    <Badge variant={getFeedbackStatusVariant(item.status)}>{FEEDBACK_STATUS_LABELS[item.status]}</Badge>
                    <Badge variant={getFeedbackPriorityVariant(item.priority)}>{FEEDBACK_PRIORITY_LABELS[item.priority]}</Badge>
                    <Badge variant="muted">{FEEDBACK_APP_AREA_LABELS[item.appArea]}</Badge>
                  </div>
                  <CardTitle>{item.title}</CardTitle>
                  <CardDescription>
                    {item.reporterName} | {item.reporterRole} | {item.reporterUnit || "Unit belum tercatat"} | {formatDateTime(item.createdAt)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="space-y-4">
                    <TextBlock title="Deskripsi" value={item.description} />
                    {item.reproductionSteps ? <TextBlock title="Langkah mengulang masalah" value={item.reproductionSteps} /> : null}
                    {item.expectedResult ? <TextBlock title="Hasil yang diharapkan" value={item.expectedResult} /> : null}
                    {item.attachmentUrl ? (
                      <a href={item.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                        Buka lampiran pendukung
                      </a>
                    ) : null}
                  </div>

                  <div className="space-y-4 rounded-2xl border border-border bg-muted/20 p-4">
                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-foreground">Status</span>
                      <NativeSelect
                        value={draft?.status ?? item.status}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [item.id]: { ...current[item.id]!, status: event.target.value as FeedbackStatus },
                          }))
                        }
                      >
                        {FEEDBACK_STATUSES.map((status) => (
                          <option key={status.id} value={status.id}>{status.label}</option>
                        ))}
                      </NativeSelect>
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-foreground">Assign ke petugas/admin</span>
                      <NativeSelect
                        value={draft?.assignedToUserId ?? ""}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [item.id]: { ...current[item.id]!, assignedToUserId: event.target.value },
                          }))
                        }
                      >
                        <option value="">Belum ditugaskan</option>
                        {users
                          .filter((user) => user.isActive && (user.roleId === "super-admin" || user.roleId === "admin"))
                          .map((user) => (
                            <option key={user.id} value={user.id}>{user.name}</option>
                          ))}
                      </NativeSelect>
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-foreground">Catatan admin</span>
                      <Textarea
                        value={draft?.adminNote ?? ""}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [item.id]: { ...current[item.id]!, adminNote: event.target.value },
                          }))
                        }
                        maxLength={3000}
                        className="min-h-24"
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-foreground">Catatan penyelesaian</span>
                      <Textarea
                        value={draft?.resolutionNote ?? ""}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [item.id]: { ...current[item.id]!, resolutionNote: event.target.value },
                          }))
                        }
                        maxLength={3000}
                        className="min-h-24"
                      />
                    </label>

                    <Button type="button" onClick={() => saveFeedback(item)} disabled={savingId === item.id}>
                      {savingId === item.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Simpan Tindak Lanjut
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="border-border/80">
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{value}</p>
        </div>
        <span className="rounded-2xl bg-primary/10 p-3 text-primary">
          <MessageSquareText className="h-5 w-5" />
        </span>
      </CardContent>
    </Card>
  );
}

function TextBlock({ title, value }: { title: string; value: string }) {
  return (
    <section className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{value}</p>
    </section>
  );
}
