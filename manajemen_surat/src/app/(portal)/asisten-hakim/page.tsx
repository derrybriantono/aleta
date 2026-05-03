"use client";

import Link from "next/link";
import { ArrowLeft, ExternalLink, Scale, ShieldCheck, Sparkles } from "lucide-react";

import { PageIntro, AccessDeniedCard, EmptyState } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  canAccessAssistantJudge,
  getVisibleAssistantJudgeLinks,
} from "@/lib/assistant-judge";
import { usePortal } from "@/lib/app-state";
import { getEffectiveRoleId } from "@/lib/permissions";

const providerTone = {
  chatgpt: "border-emerald-200 bg-emerald-50/80 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200",
  gemini: "border-sky-200 bg-sky-50/80 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-200",
  claude: "border-violet-200 bg-violet-50/80 text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-200",
  default: "border-slate-200 bg-slate-50/80 text-slate-700 dark:border-slate-500/20 dark:bg-slate-500/10 dark:text-slate-200",
};

export default function AssistantJudgePage() {
  const { assistantJudgeConfig, currentUser } = usePortal();
  const roleId = getEffectiveRoleId(currentUser);

  if (!assistantJudgeConfig.enabled) {
    return (
      <div className="space-y-8">
        <PageIntro
          eyebrow="AI Yudisial"
          title="Asisten Hakim"
          description="Fitur Asisten Hakim sedang dinonaktifkan oleh Super Admin."
          actions={
            <Button asChild variant="outline">
              <Link href="/portal">
                <ArrowLeft className="h-4 w-4" />
                Kembali ke Portal Utama
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

  const enabledLinks = getVisibleAssistantJudgeLinks(assistantJudgeConfig, roleId, currentUser?.id);

  return (
    <div className="space-y-8">
      <PageIntro
        eyebrow="AI Yudisial"
        title="Asisten Hakim"
        description="Pilih asisten AI yang tersedia untuk membantu pekerjaan yudisial. Gunakan hasil AI sebagai bahan bantu yang tetap harus diverifikasi secara profesional."
        actions={
          <Button asChild variant="outline">
            <Link href="/portal">
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Portal Utama
            </Link>
          </Button>
        }
      />

      <Card className="border-amber-200 bg-amber-50/80 dark:border-amber-500/20 dark:bg-amber-500/10">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
          <div className="rounded-2xl bg-white/80 p-3 text-amber-700 shadow-sm dark:bg-slate-950/70 dark:text-amber-200">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">Catatan penggunaan</h2>
            <p className="text-sm leading-7 text-muted-foreground">
              Asisten AI adalah alat bantu. Setiap hasil harus diverifikasi, disesuaikan dengan fakta perkara, hukum acara, dan ketentuan yang berlaku sebelum digunakan dalam pekerjaan resmi.
            </p>
          </div>
        </CardContent>
      </Card>

      {enabledLinks.length > 0 ? (
        <div className="grid gap-5 md:grid-cols-3">
          {enabledLinks.map((link) => {
            const providerId = link.provider ?? link.id ?? "custom";
            const tone = providerTone[providerId as keyof typeof providerTone] ?? providerTone.default;

            return (
            <Card key={link.id ?? providerId} className="flex h-full flex-col border-border/80">
              <CardHeader>
                <div className={`mb-3 w-fit rounded-2xl border p-3 ${tone}`}>
                  {link.iconKey === "scale" || providerId === "claude" ? <Scale className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
                </div>
                <div className="space-y-2">
                  <Badge variant="muted">Asisten AI</Badge>
                  <CardTitle className="text-xl">{link.label}</CardTitle>
                  <CardDescription className="leading-6">{link.description}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="mt-auto">
                <Button asChild className="w-full">
                  <a href={link.url} target={link.openInNewTab === false ? undefined : "_blank"} rel="noopener noreferrer">
                    Buka {link.label.split(" - ")[0]}
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          );
          })}
        </div>
      ) : (
        <EmptyState title="Belum ada Asisten AI yang tersedia untuk akun Anda." description="Silakan hubungi Super Admin jika akses Asisten Hakim perlu ditambahkan." />
      )}
    </div>
  );
}
