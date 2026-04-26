"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, FileSearch, ShieldCheck, Sparkles } from "lucide-react";

import { AletaAIMark } from "@/components/branding/aleta-ai-mark";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePortal } from "@/lib/app-state";
import { isPrivilegedAdmin } from "@/lib/permissions";
import {
  type DispositionNode,
  type LetterDetail,
  type MailIntelligencePayload,
  type MailIntelligencePriorityLevel,
} from "@/lib/types";
import {
  MailIntelligenceRequestError,
  fetchMailIntelligenceInsight,
} from "@/modules/manajemen-surat/services/aleta-mail-intelligence";
import { cn } from "@/lib/utils";

type IntelligenceState =
  | { status: "idle"; insight: null; errorMessage: null }
  | { status: "loading"; insight: null; errorMessage: null }
  | { status: "ready"; insight: MailIntelligencePayload; errorMessage: null }
  | { status: "error"; insight: null; errorMessage: string };

const PRIORITY_COPY: Record<MailIntelligencePriorityLevel, { label: string; variant: "success" | "warning" | "danger" | "default" }> = {
  low: { label: "Prioritas rendah", variant: "success" },
  medium: { label: "Prioritas sedang", variant: "default" },
  high: { label: "Prioritas tinggi", variant: "warning" },
  urgent: { label: "Mendesak / urgent", variant: "danger" },
};

const SOURCE_LABEL: Record<MailIntelligencePayload["source"], string> = {
  "ai-live": "Analisis AI live",
  heuristic: "Fallback heuristik (bukan AI)",
  disabled: "AI dimatikan",
  error: "Provider AI gagal",
};

export function AletaMailInsights({
  letter,
  timeline,
}: {
  letter: LetterDetail;
  timeline: DispositionNode[];
}) {
  const { aiConfig, currentUser } = usePortal();
  const isAdmin = isPrivilegedAdmin(currentUser);
  const [state, setState] = useState<IntelligenceState>({ status: "idle", insight: null, errorMessage: null });
  const mailFlags = aiConfig.featureFlags.mailIntelligence;
  const mailIntelligenceEnabled = aiConfig.enabled && aiConfig.featureManajemenSuratAi && mailFlags.enabled;

  const timelineKey = useMemo(
    () => timeline.map((item) => `${item.id}:${item.status}:${item.createdAt}`).join("|"),
    [timeline]
  );
  const requestKey = `${letter.id}:${aiConfig.activeConnectionId ?? ""}:${aiConfig.modelId}:${aiConfig.primaryLanguage}:${mailIntelligenceEnabled ? "1" : "0"}:${JSON.stringify(mailFlags)}:${timelineKey}`;

  useEffect(() => {
    if (!currentUser) return;
    if (!mailIntelligenceEnabled) {
      setState({ status: "idle", insight: null, errorMessage: null });
      return;
    }
    const controller = new AbortController();
    setState({ status: "loading", insight: null, errorMessage: null });

    fetchMailIntelligenceInsight({
      letterId: letter.id,
      actorUserId: currentUser.id,
      signal: controller.signal,
    })
      .then((insight) => {
        if (controller.signal.aborted) return;
        setState({ status: "ready", insight, errorMessage: null });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if ((error as { name?: string }).name === "AbortError") return;
        const message =
          error instanceof MailIntelligenceRequestError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Gagal memuat hasil analisis ALETA Intelligence.";
        setState({ status: "error", insight: null, errorMessage: message });
      });

    return () => controller.abort();
  }, [currentUser?.id, mailIntelligenceEnabled, requestKey]);

  return (
    <Card className="border-border/80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AletaAIMark compact />
          ALETA Intelligence Service
        </CardTitle>
        <CardDescription>
          Analisis AI: ringkasan, temuan, prioritas, dan saran tindak lanjut.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!mailIntelligenceEnabled ? (
          <div className="rounded-[1.3rem] border border-border bg-muted/25 px-4 py-3 text-sm text-muted-foreground">
            AI sedang dinonaktifkan oleh administrator.
          </div>
        ) : state.status === "loading" || state.status === "idle" ? (
          <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
            <InsightLoadingBlock />
            <InsightLoadingBlock />
          </div>
        ) : state.status === "error" ? (
          <AletaIntelligenceError message={state.errorMessage} />
        ) : (
          <AletaIntelligenceBody letter={letter} insight={state.insight} isAdmin={isAdmin} />
        )}
      </CardContent>
    </Card>
  );
}

function AletaIntelligenceBody({
  letter,
  insight,
  isAdmin,
}: {
  letter: LetterDetail;
  insight: MailIntelligencePayload;
  isAdmin: boolean;
}) {
  const priority = PRIORITY_COPY[insight.priority.level];
  const providerLabel = insight.provider.connectionLabel ?? insight.provider.providerName;
  const confidencePercent = Math.round(insight.confidence.score * 100);
  const isLive = insight.source === "ai-live";
  const sourceTone = isLive
    ? "border-primary/40 bg-primary/10"
    : insight.source === "error"
      ? "border-destructive/40 bg-destructive/10"
      : "border-amber-300 bg-amber-50";

  return (
    <div className="space-y-4">
      {isAdmin ? (
        <div className={cn("rounded-[1.3rem] border p-4 text-sm", sourceTone)}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={isLive ? "default" : insight.source === "error" ? "danger" : "warning"}>
              {SOURCE_LABEL[insight.source]}
            </Badge>
            <Badge variant="outline">Provider: {providerLabel}</Badge>
            <Badge variant="outline">Model: {insight.provider.providerModelId || insight.provider.modelId}</Badge>
            <Badge variant="outline">
              Bahasa: {insight.provider.language === "id" ? "Bahasa Indonesia" : "English"}
            </Badge>
            {insight.provider.connectionStatus ? (
              <Badge
                variant={
                  insight.provider.connectionStatus === "connected"
                    ? "success"
                    : insight.provider.connectionStatus === "failed"
                      ? "danger"
                      : "outline"
                }
              >
                Status koneksi: {insight.provider.connectionStatus}
              </Badge>
            ) : null}
          </div>
          <p className="mt-3 text-muted-foreground">{insight.rationale}</p>
          {insight.message ? (
            <p className="mt-2 text-xs font-medium text-amber-700">{insight.message}</p>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 rounded-[1.2rem] border border-border bg-muted/20 px-4 py-2.5 text-sm">
          <Badge variant={isLive ? "default" : insight.source === "error" ? "danger" : "warning"}>
            {isLive ? "Analisis AI" : insight.source === "disabled" ? "AI tidak aktif" : insight.source === "error" ? "AI gagal" : "Analisis otomatis"}
          </Badge>
          {insight.message ? (
            <span className="font-medium text-amber-700">{insight.message}</span>
          ) : null}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-4 rounded-[1.4rem] border border-border bg-muted/30 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                Ringkasan AI
              </p>
            </div>
            <Badge variant={priority.variant}>{priority.label}</Badge>
          </div>

          <p className="text-sm leading-7 text-foreground">{insight.summary}</p>

          <div className="rounded-[1.15rem] border border-dashed border-primary/30 bg-card/70 p-3 text-xs text-muted-foreground">
            Alasan prioritas: {insight.priority.reason}
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Temuan utama</p>
            {insight.keyFindings.length === 0 ? (
              <p className="rounded-[1.1rem] border border-border bg-card/80 px-4 py-3 text-sm text-muted-foreground">
                AI belum dapat menemukan poin konkret dari data yang tersedia.
              </p>
            ) : (
              insight.keyFindings.map((point, index) => (
                <div
                  key={`${index}-${point.slice(0, 20)}`}
                  className="rounded-[1.1rem] border border-border bg-card/80 px-4 py-3 text-sm text-muted-foreground"
                >
                  {point}
                </div>
              ))
            )}
          </div>

          {isAdmin ? (
            <div>
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                <span>Confidence</span>
                <span>{confidencePercent}% · {insight.confidence.label}</span>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-muted">
                <div
                  className={cn(
                    "h-2 rounded-full",
                    insight.confidence.level === "high"
                      ? "bg-emerald-500"
                      : insight.confidence.level === "medium"
                        ? "bg-amber-500"
                        : "bg-rose-500"
                  )}
                  style={{ width: `${Math.max(6, Math.min(100, confidencePercent))}%` }}
                />
              </div>
              {insight.confidence.level === "low" ? (
                <p className="mt-2 text-xs font-medium text-amber-700">
                  Keyakinan rendah. Jangan dipakai sebagai keputusan final tanpa verifikasi manual.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Keyakinan:</span>
              <Badge
                variant={
                  insight.confidence.level === "high"
                    ? "success"
                    : insight.confidence.level === "medium"
                      ? "default"
                      : "warning"
                }
              >
                {insight.confidence.label}
              </Badge>
              {insight.confidence.level === "low" ? (
                <span className="text-xs text-amber-700">Verifikasi manual diperlukan.</span>
              ) : null}
            </div>
          )}
        </div>

        <div className="space-y-4 rounded-[1.4rem] border border-border bg-card/80 p-5">
          <div>
            <AletaAIMark label="Saran tindak lanjut AI" />
            <div className="mt-3 space-y-3">
              {insight.followUpSuggestions.length === 0 ? (
                <p className="rounded-[1.15rem] border border-dashed border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                  AI tidak menyarankan langkah tambahan di luar prosedur standar.
                </p>
              ) : (
                insight.followUpSuggestions.map((suggestion) => (
                  <div key={suggestion.id} className="rounded-[1.15rem] border border-border bg-muted/35 p-4">
                    <p className="text-sm font-semibold text-foreground">{suggestion.label}</p>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">{suggestion.detail}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Kandidat jabatan rujukan
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {insight.suggestedPositionLabels.length === 0 ? (
                <Badge variant="outline">Tidak ada rekomendasi spesifik</Badge>
              ) : (
                insight.suggestedPositionLabels.map((label) => (
                  <Badge key={label} variant="warning">
                    {label}
                  </Badge>
                ))
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-primary">
              <FileSearch className="h-4 w-4" />
              <p className="text-xs font-semibold uppercase tracking-[0.2em]">Regulasi terkait</p>
            </div>
            {insight.regulations.length === 0 ? (
              <p className="rounded-[1.2rem] border border-dashed border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                Tidak ada regulasi rujukan yang cukup relevan pada knowledge base internal.
              </p>
            ) : (
              insight.regulations.map((regulation) => (
                <div key={regulation.id} className="rounded-[1.2rem] border border-border bg-muted/35 p-4">
                  <p className="font-semibold text-foreground">{regulation.title}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {regulation.citation}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{regulation.summary}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-[1.3rem] border border-amber-300/70 bg-amber-50 px-4 py-3 dark:border-amber-700/40 dark:bg-amber-950/30">
        <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
          <ShieldCheck className="h-4 w-4" />
          <p className="text-xs font-semibold uppercase tracking-[0.2em]">Perlu verifikasi manual</p>
        </div>
        <ul className="mt-2 space-y-1.5 text-sm leading-6 text-amber-900 dark:text-amber-200">
          {insight.verificationChecklist.map((item, index) => (
            <li key={`${index}-${item.slice(0, 24)}`} className="flex items-start gap-2">
              <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600 dark:bg-amber-500" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">
          Hasil analisis ini bersifat tambahan dan tidak menggantikan telaah serta keputusan manual oleh PIC yang berwenang.
        </p>
      </div>
    </div>
  );
}

function AletaIntelligenceError({ message }: { message: string }) {
  return (
    <div className="rounded-[1.4rem] border border-destructive/40 bg-destructive/5 p-5 text-sm text-destructive">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        <p className="font-semibold">ALETA Intelligence tidak dapat dimuat.</p>
      </div>
      <p className="mt-2 text-destructive/80">{message}</p>
      <Button
        variant="outline"
        size="sm"
        className="mt-3"
        onClick={() => {
          if (typeof window !== "undefined") {
            window.location.reload();
          }
        }}
      >
        Muat ulang halaman
      </Button>
    </div>
  );
}

function InsightLoadingBlock() {
  return (
    <div className="space-y-3 rounded-[1.4rem] border border-border bg-muted/30 p-5">
      <div className="h-5 w-40 rounded-full bg-muted" />
      <div className="h-4 w-full rounded-full bg-muted/80" />
      <div className="h-4 w-[86%] rounded-full bg-muted/80" />
      <div className="h-20 rounded-[1.1rem] bg-muted/70" />
      <div className="h-20 rounded-[1.1rem] bg-muted/70" />
    </div>
  );
}
