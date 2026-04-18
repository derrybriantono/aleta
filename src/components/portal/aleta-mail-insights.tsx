"use client";

import { useEffect, useMemo, useState } from "react";
import { FileSearch } from "lucide-react";

import { getMailIntelligenceInsight } from "@/modules/manajemen-surat/services/aleta-mail-intelligence";
import { AletaAIMark } from "@/components/branding/aleta-ai-mark";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePortal } from "@/lib/app-state";
import { type DispositionNode, type LetterDetail } from "@/lib/types";

export function AletaMailInsights({
  letter,
  timeline,
}: {
  letter: LetterDetail;
  timeline: DispositionNode[];
}) {
  const { aiConfig } = usePortal();
  const [state, setState] = useState<{
    loading: boolean;
    insight: Awaited<ReturnType<typeof getMailIntelligenceInsight>> | null;
    requestKey: string;
  }>({
    loading: true,
    insight: null,
    requestKey: "",
  });

  const timelineKey = useMemo(
    () => timeline.map((item) => `${item.id}:${item.status}:${item.createdAt}`).join("|"),
    [timeline]
  );
  const requestKey = `${letter.id}:${aiConfig.modelId}:${aiConfig.primaryLanguage}:${timelineKey}`;

  useEffect(() => {
    let cancelled = false;

    if (!aiConfig.enabled) {
      return;
    }

    getMailIntelligenceInsight({
      letter,
      timeline,
      aiConfig,
    }).then((insight) => {
      if (cancelled) return;
      setState({ loading: false, insight, requestKey });
    });

    return () => {
      cancelled = true;
    };
  }, [aiConfig, letter, requestKey, timeline]);

  if (!aiConfig.enabled) {
    return null;
  }

  const isLoading = state.loading || state.requestKey !== requestKey;

  return (
    <Card className="border-border/80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AletaAIMark compact />
          ALETA Intelligence Service
        </CardTitle>
        <CardDescription>
          Ringkasan otomatis surat dan saran disposisi cerdas, diproses async agar detail surat tetap terasa ringan saat dibuka.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading || !state.insight ? (
          <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
            <InsightLoadingBlock />
            <InsightLoadingBlock />
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
            <div className="space-y-4 rounded-[1.4rem] border border-border bg-muted/30 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{aiConfig.modelId}</Badge>
                <Badge variant="default">
                  {aiConfig.primaryLanguage === "id" ? "Bahasa Indonesia" : "English"}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Ringkasan otomatis</p>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{state.insight.summary}</p>
              </div>
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Poin penting</p>
                {state.insight.keyPoints.map((point) => (
                  <div key={point} className="rounded-[1.1rem] border border-border bg-card/80 px-4 py-3 text-sm text-muted-foreground">
                    {point}
                  </div>
                ))}
              </div>
              <div className="rounded-[1.2rem] border border-dashed border-primary/30 bg-primary/5 p-4 text-sm text-muted-foreground">
                {state.insight.rationale}
              </div>
            </div>

            <div className="space-y-4 rounded-[1.4rem] border border-border bg-card/80 p-5">
              <div>
                <AletaAIMark label="Smart Disposition Suggestion" />
                <p className="mt-3 text-sm font-semibold text-foreground">Jabatan yang direkomendasikan</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {state.insight.suggestedPositionLabels.length === 0 ? (
                    <Badge variant="outline">Tidak ada rekomendasi spesifik</Badge>
                  ) : (
                    state.insight.suggestedPositionLabels.map((label) => (
                      <Badge key={label} variant="warning">
                        {label}
                      </Badge>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-[1.2rem] border border-border bg-muted/35 p-4">
                <p className="text-sm font-semibold text-foreground">Saran instruksi</p>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{state.insight.suggestedInstruction}</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-primary">
                  <FileSearch className="h-4 w-4" />
                  <p className="text-xs font-semibold uppercase tracking-[0.2em]">Regulasi terkait</p>
                </div>
                {state.insight.regulations.map((regulation) => (
                  <div key={regulation.id} className="rounded-[1.2rem] border border-border bg-muted/35 p-4">
                    <p className="font-semibold text-foreground">{regulation.title}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">{regulation.citation}</p>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">{regulation.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
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
