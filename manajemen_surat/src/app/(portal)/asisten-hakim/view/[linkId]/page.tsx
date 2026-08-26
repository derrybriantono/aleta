"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ExternalLink, LoaderCircle, RefreshCw, Scale, ShieldCheck } from "lucide-react";

import { AccessDeniedCard, EmptyState, PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  canAccessAssistantJudge,
  canAccessAssistantJudgeLink,
  findAssistantJudgeLinkByIdentifier,
  isAssistantJudgeEmbeddedEnabled,
} from "@/lib/assistant-judge";
import { usePortal } from "@/lib/app-state";
import { apiPath } from "@/lib/base-path";
import { getEffectiveRoleId } from "@/lib/permissions";

function readRouteLinkId(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (!rawValue) return "";

  try {
    return decodeURIComponent(rawValue);
  } catch {
    return rawValue;
  }
}

export default function AssistantJudgeEmbeddedViewPage() {
  const params = useParams<{ linkId?: string }>();
  const { assistantJudgeConfig, currentUser } = usePortal();
  const roleId = getEffectiveRoleId(currentUser);
  const linkId = readRouteLinkId(params.linkId);
  const [frameKey, setFrameKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showEmbedNote, setShowEmbedNote] = useState(false);

  const selectedLink = useMemo(
    () => findAssistantJudgeLinkByIdentifier(assistantJudgeConfig, linkId),
    [assistantJudgeConfig, linkId]
  );

  useEffect(() => {
    if (!isLoading) return;

    const timer = window.setTimeout(() => {
      setShowEmbedNote(true);
    }, 9000);

    return () => window.clearTimeout(timer);
  }, [frameKey, isLoading, linkId]);

  if (!assistantJudgeConfig.enabled) {
    return (
      <div className="space-y-8">
        <PageIntro
          eyebrow="AI Yudisial"
          title="Asisten Hakim"
          description="Fitur Asisten Hakim sedang dinonaktifkan oleh Super Admin."
          actions={
            <Button asChild variant="outline">
              <Link href="/asisten-hakim">
                <ArrowLeft className="h-4 w-4" />
                Kembali
              </Link>
            </Button>
          }
        />
        <EmptyState title="Fitur belum aktif" description="Silakan hubungi Super Admin jika Asisten Hakim perlu diaktifkan untuk peran Anda." />
      </div>
    );
  }

  if (!canAccessAssistantJudge(roleId, assistantJudgeConfig, currentUser?.id)) {
    return <AccessDeniedCard />;
  }

  if (!selectedLink) {
    return (
      <div className="space-y-8">
        <PageIntro
          eyebrow="AI Yudisial"
          title="Asisten tidak ditemukan"
          description="Menu AI yang diminta belum tersedia atau sudah dinonaktifkan."
          actions={
            <Button asChild variant="outline">
              <Link href="/asisten-hakim">
                <ArrowLeft className="h-4 w-4" />
                Pilih Asisten AI
              </Link>
            </Button>
          }
        />
        <EmptyState title="Menu AI tidak tersedia" description="Silakan pilih Asisten AI lain dari halaman Asisten Hakim." />
      </div>
    );
  }

  if (!canAccessAssistantJudgeLink(selectedLink, roleId, currentUser?.id)) {
    return <AccessDeniedCard />;
  }

  if (!isAssistantJudgeEmbeddedEnabled(selectedLink)) {
    return (
      <div className="space-y-8">
        <PageIntro
          eyebrow="AI Yudisial"
          title={selectedLink.label}
          description="Mode wrapped/embedded untuk AI ini sedang dinonaktifkan dari Pengaturan Asisten Hakim."
          actions={
            <Button asChild variant="outline">
              <Link href="/asisten-hakim">
                <ArrowLeft className="h-4 w-4" />
                Pilih AI Lain
              </Link>
            </Button>
          }
        />
        <Card className="border-border/80">
          <CardContent className="space-y-5 p-6">
            <div className="space-y-2">
              <h2 className="font-serif text-2xl text-foreground">Wrapped/embedded nonaktif</h2>
              <p className="text-sm leading-7 text-muted-foreground">
                Super Admin mengatur menu ini agar dibuka langsung ke website AI. Aktifkan kembali toggle wrapped/embedded pada Pengaturan Asisten Hakim jika ingin memuatnya di dalam ALETA.
              </p>
            </div>
            <Button asChild>
              <a href={selectedLink.url} target={selectedLink.openInNewTab === false ? undefined : "_blank"} rel="noopener noreferrer">
                Buka Website AI
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const frameSrc = apiPath(`/api/assistant-judge/launch/${encodeURIComponent(linkId)}`);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="AI Yudisial"
        title={selectedLink.label}
        description={selectedLink.description}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/asisten-hakim">
                <ArrowLeft className="h-4 w-4" />
                Pilih AI Lain
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsLoading(true);
                setShowEmbedNote(false);
                setFrameKey((current) => current + 1);
              }}
            >
              <RefreshCw className="h-4 w-4" />
              Muat Ulang
            </Button>
          </div>
        }
      />

      <Card className="border-border/80 bg-card/70">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="rounded-2xl bg-primary/10 p-3 text-primary">
              <Scale className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground">{selectedLink.label}</p>
              <p className="text-sm text-muted-foreground">Dibuka dalam tampilan ALETA.</p>
            </div>
          </div>
          <Badge variant="outline" className="w-fit">
            <ShieldCheck className="h-3.5 w-3.5" />
            Mode ALETA
          </Badge>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-border/80">
        <div className="relative bg-slate-950">
          {isLoading ? (
            <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 border-b border-white/10 bg-slate-950/95 px-4 py-3 text-sm text-slate-100">
              <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
              Memuat Asisten AI di dalam ALETA...
            </div>
          ) : null}
          <iframe
            key={frameKey}
            title={selectedLink.label}
            src={frameSrc}
            className="h-[calc(100vh-18rem)] min-h-[640px] w-full border-0 bg-white"
            referrerPolicy="no-referrer"
            sandbox="allow-downloads allow-forms allow-modals allow-popups allow-same-origin allow-scripts"
            onLoad={() => setIsLoading(false)}
          />
        </div>
      </Card>

      {showEmbedNote ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
          Jika halaman AI tidak tampil, kemungkinan website tujuan menolak mode tertanam melalui pengaturan keamanan mereka. Gunakan URL AI yang mengizinkan embedded view pada Pengaturan Asisten Hakim.
        </div>
      ) : null}
    </div>
  );
}
