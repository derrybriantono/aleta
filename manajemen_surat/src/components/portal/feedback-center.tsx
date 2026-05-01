"use client";

import Link from "next/link";
import { ArrowLeft, Bug, CheckCircle2, Lightbulb, LoaderCircle, Send, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  FEEDBACK_APP_AREAS,
  FEEDBACK_APP_AREA_LABELS,
  FEEDBACK_CATEGORIES,
  FEEDBACK_PRIORITIES,
  FEEDBACK_PRIORITY_LABELS,
  FEEDBACK_TYPE_DESCRIPTIONS,
  FEEDBACK_TYPE_LABELS,
  FEEDBACK_TYPES,
  getFeedbackDescriptionPlaceholder,
  getFeedbackExpectedPlaceholder,
  getFeedbackPriorityVariant,
  getFeedbackStatusVariant,
  type FeedbackAppArea,
  type FeedbackPriority,
  type FeedbackRequest,
  type FeedbackType,
} from "@/lib/feedback";
import { formatDateTime } from "@/lib/format";
import { getUserPositionLabel, getUserRoleBadge } from "@/lib/permissions";
import { usePortal } from "@/lib/app-state";
import { cn } from "@/lib/utils";

type FeedbackFormState = {
  type: FeedbackType;
  title: string;
  appArea: FeedbackAppArea;
  category: string;
  priority: FeedbackPriority;
  description: string;
  reproductionSteps: string;
  expectedResult: string;
  attachmentUrl: string;
};

const typeIcons = {
  bug: Bug,
  feature: Lightbulb,
  app_idea: Sparkles,
};

function initialForm(type: FeedbackType = "bug"): FeedbackFormState {
  return {
    type,
    title: "",
    appArea: "portal",
    category: FEEDBACK_CATEGORIES[type][0] ?? "Lainnya",
    priority: "medium",
    description: "",
    reproductionSteps: "",
    expectedResult: "",
    attachmentUrl: "",
  };
}

async function readApiJson<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; data?: T; error?: { message?: string } }
    | null;

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error?.message ?? "Permintaan tidak dapat diproses.");
  }

  return payload.data as T;
}

export function FeedbackCenter() {
  const { currentUser } = usePortal();
  const [form, setForm] = useState<FeedbackFormState>(() => initialForm());
  const [items, setItems] = useState<FeedbackRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const selectedTypeInfo = FEEDBACK_TYPES.find((item) => item.id === form.type) ?? FEEDBACK_TYPES[0]!;

  useEffect(() => {
    document.title = "Pusat Masukan ALETA - ALETA";
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      setLoading(true);
      try {
        const response = await fetch("/api/feedback", {
          credentials: "include",
          cache: "no-store",
        });
        const data = await readApiJson<{ items: FeedbackRequest[] }>(response);
        if (!cancelled) setItems(data.items ?? []);
      } catch (error) {
        if (!cancelled) {
          setMessage({
            type: "error",
            text: error instanceof Error ? error.message : "Riwayat masukan gagal dimuat.",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, []);

  const validationError = useMemo(() => {
    if (!form.title.trim()) return "Judul singkat wajib diisi.";
    if (form.title.trim().length > 150) return "Judul maksimal 150 karakter.";
    if (!form.description.trim()) return "Deskripsi wajib diisi.";
    if (form.description.trim().length > 5000) return "Deskripsi maksimal 5000 karakter.";
    if (form.reproductionSteps.trim().length > 3000) return "Langkah mengulang masalah maksimal 3000 karakter.";
    if (form.expectedResult.trim().length > 3000) return "Hasil yang diharapkan maksimal 3000 karakter.";
    if (form.attachmentUrl.trim()) {
      try {
        const url = new URL(form.attachmentUrl.trim());
        if (url.protocol !== "http:" && url.protocol !== "https:") {
          return "Link lampiran harus berupa URL http/https.";
        }
      } catch {
        return "Link lampiran tidak valid.";
      }
    }
    return null;
  }, [form]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (validationError) {
      setMessage({ type: "error", text: validationError });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(form),
      });
      const data = await readApiJson<{ item: FeedbackRequest }>(response);
      setItems((current) => [data.item, ...current]);
      setForm(initialForm(form.type));
      setMessage({
        type: "success",
        text: "Masukan berhasil dikirim. Terima kasih, admin dapat meninjau dari menu Masukan Pengguna.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Masukan gagal dikirim.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Beri Masukan"
        title="Pusat Masukan ALETA"
        description="Laporkan kendala, ajukan saran fitur, atau usulkan aplikasi baru untuk pengembangan ALETA."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/portal">
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Portal Utama
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {FEEDBACK_TYPES.map((type) => {
          const Icon = typeIcons[type.id];
          const active = form.type === type.id;

          return (
            <button
              key={type.id}
              type="button"
              onClick={() => setForm((current) => ({ ...initialForm(type.id), title: current.title }))}
              className={cn(
                "rounded-2xl border bg-card p-5 text-left transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-panel",
                active ? "border-primary/55 ring-2 ring-primary/15" : "border-border/80"
              )}
            >
              <div className="flex items-start gap-4">
                <span className={cn("rounded-2xl p-3", active ? "bg-primary text-primary-foreground" : "bg-muted text-primary")}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="space-y-1">
                  <span className="block font-semibold text-foreground">{type.label}</span>
                  <span className="block text-sm leading-6 text-muted-foreground">{type.description}</span>
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-border/80">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">{selectedTypeInfo.label}</Badge>
              <Badge variant="outline">Form masukan</Badge>
            </div>
            <CardTitle>{FEEDBACK_TYPE_LABELS[form.type]}</CardTitle>
            <CardDescription>{FEEDBACK_TYPE_DESCRIPTIONS[form.type]}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {message ? (
              <div
                className={cn(
                  "rounded-xl border px-4 py-3 text-sm",
                  message.type === "success"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                    : "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
                )}
              >
                {message.text}
              </div>
            ) : null}

            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">Judul singkat</span>
              <Input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                maxLength={150}
                placeholder="Contoh: Tombol Connect WhatsApp tidak menampilkan QR"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">Aplikasi terkait</span>
                <NativeSelect
                  value={form.appArea}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, appArea: event.target.value as FeedbackAppArea }))
                  }
                >
                  {FEEDBACK_APP_AREAS.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.label}
                    </option>
                  ))}
                </NativeSelect>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">Kategori</span>
                <NativeSelect
                  value={form.category}
                  onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                >
                  {FEEDBACK_CATEGORIES[form.type].map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </NativeSelect>
              </label>
            </div>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">
                {form.type === "bug" ? "Dampak Kendala" : "Prioritas Usulan"}
              </span>
              <NativeSelect
                value={form.priority}
                onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as FeedbackPriority }))}
              >
                {FEEDBACK_PRIORITIES.map((priority) => (
                  <option key={priority.id} value={priority.id}>
                    {priority.label}
                  </option>
                ))}
              </NativeSelect>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">Deskripsi</span>
              <Textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                maxLength={5000}
                placeholder={getFeedbackDescriptionPlaceholder(form.type)}
                className="min-h-36"
              />
            </label>

            {form.type === "bug" ? (
              <label className="space-y-2">
                <span className="text-sm font-semibold text-foreground">Langkah-langkah agar bug bisa diuji ulang</span>
                <Textarea
                  value={form.reproductionSteps}
                  onChange={(event) => setForm((current) => ({ ...current, reproductionSteps: event.target.value }))}
                  maxLength={3000}
                  placeholder="Contoh: buka ALETA Bot, klik Connect WhatsApp, tunggu 10 detik, QR tidak muncul."
                  className="min-h-28"
                />
              </label>
            ) : null}

            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">Hasil yang diharapkan</span>
              <Textarea
                value={form.expectedResult}
                onChange={(event) => setForm((current) => ({ ...current, expectedResult: event.target.value }))}
                maxLength={3000}
                placeholder={getFeedbackExpectedPlaceholder(form.type)}
                className="min-h-24"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">Link screenshot/dokumen pendukung</span>
              <Input
                value={form.attachmentUrl}
                onChange={(event) => setForm((current) => ({ ...current, attachmentUrl: event.target.value }))}
                placeholder="Opsional: https://..."
              />
            </label>

            <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
              {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Kirim Masukan
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-border/80">
            <CardHeader>
              <CardTitle>Kontak Pelapor</CardTitle>
              <CardDescription>Diambil otomatis dari akun login. Anda tidak perlu mengetik ulang data diri.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <InfoRow label="Nama" value={currentUser?.name ?? "-"} />
              <InfoRow label="Role" value={getUserRoleBadge(currentUser)} />
              <InfoRow label="Unit/Jabatan" value={getUserPositionLabel(currentUser)} />
              <InfoRow label="Email" value={currentUser?.email ?? "-"} />
            </CardContent>
          </Card>

          <Card className="border-border/80">
            <CardHeader>
              <CardTitle>Riwayat Masukan Saya</CardTitle>
              <CardDescription>User biasa hanya melihat masukan yang pernah dikirim dari akunnya sendiri.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Memuat riwayat...
                </div>
              ) : items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                  Belum ada masukan yang dikirim.
                </div>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{FEEDBACK_TYPE_LABELS[item.type]}</Badge>
                      <Badge variant={getFeedbackStatusVariant(item.status)}>
                        {item.status === "new" ? "Baru" : item.status === "in_progress" ? "Diproses" : item.status === "needs_info" ? "Butuh Informasi" : item.status === "done" ? "Selesai" : item.status === "rejected" ? "Ditolak" : item.status === "planned" ? "Direncanakan" : item.status === "duplicate" ? "Duplikat" : item.status === "reviewed" ? "Ditinjau" : "Ditunda"}
                      </Badge>
                      <Badge variant={getFeedbackPriorityVariant(item.priority)}>{FEEDBACK_PRIORITY_LABELS[item.priority]}</Badge>
                    </div>
                    <p className="mt-3 font-semibold text-foreground">{item.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {FEEDBACK_APP_AREA_LABELS[item.appArea]} | {formatDateTime(item.createdAt)}
                    </p>
                    {item.adminNote ? (
                      <p className="mt-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm leading-6 text-muted-foreground">
                        Catatan admin: {item.adminNote}
                      </p>
                    ) : null}
                    {item.resolutionNote ? (
                      <p className="mt-2 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm leading-6 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" />
                        {item.resolutionNote}
                      </p>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-muted/20 px-4 py-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value || "-"}</span>
    </div>
  );
}
