"use client";

import Link from "next/link";
import { ArrowRight, BellRing, ListTodo, MessageCircleMore, Send, ShieldCheck } from "lucide-react";

import { MainAppHub } from "@/components/portal/main-app-hub";
import { PageIntro } from "@/components/portal/shared";
import { WorkSummaryHero } from "@/components/portal/work-summary-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePortal } from "@/lib/app-state";
import { getEffectivePosition, getEffectiveRoleId, getUserRoleBadge } from "@/lib/permissions";
import { sortTaskItems, type TaskItem } from "@/lib/task-sources";

const taskVisuals: Record<TaskItem["sourceType"], { icon: typeof ListTodo; iconBg: string; iconColor: string; badgeClassName?: string }> = {
  disposition: {
    icon: ListTodo,
    iconBg: "bg-amber-100 dark:bg-amber-900/30",
    iconColor: "text-amber-700 dark:text-amber-500",
  },
  letter: {
    icon: Send,
    iconBg: "bg-indigo-100 dark:bg-indigo-900/30",
    iconColor: "text-indigo-700 dark:text-indigo-500",
    badgeClassName: "bg-indigo-500",
  },
  wa_failed: {
    icon: MessageCircleMore,
    iconBg: "bg-rose-100 dark:bg-rose-950/40",
    iconColor: "text-rose-700 dark:text-rose-300",
  },
  feedback: {
    icon: MessageCircleMore,
    iconBg: "bg-sky-100 dark:bg-sky-950/40",
    iconColor: "text-sky-700 dark:text-sky-300",
    badgeClassName: "bg-sky-500",
  },
  approval: {
    icon: ShieldCheck,
    iconBg: "bg-violet-100 dark:bg-violet-950/40",
    iconColor: "text-violet-700 dark:text-violet-300",
  },
  system_task: {
    icon: MessageCircleMore,
    iconBg: "bg-slate-100 dark:bg-slate-900/40",
    iconColor: "text-slate-700 dark:text-slate-300",
  },
};

export default function PortalPage() {
  const {
    accessibleLetters,
    accessibleModules,
    accessiblePortalApps,
    currentUser,
    dispositions,
    pendingInbox,
    globalTaskCount,
    taskSources,
    taskSummary,
  } = usePortal();
  const position = getEffectivePosition(currentUser);
  const effectiveRoleId = getEffectiveRoleId(currentUser);
  const currentRoleBadge = getUserRoleBadge(currentUser);
  const isAdminTier = effectiveRoleId === "super-admin" || effectiveRoleId === "admin";
  const newIncomingCount = accessibleLetters.filter((letter) => letter.type === "masuk" && letter.status === "Baru").length;
  const failedWhatsappCount =
    accessibleLetters.reduce(
      (count, letter) => count + letter.whatsappDeliveries.filter((delivery) => delivery.status === "Gagal").length,
      0
    ) +
    dispositions.reduce((count, disposition) => {
      const isRelevant = pendingInbox.some((item) => item.id === disposition.id) || disposition.pengirimId === currentUser?.id;

      return isRelevant
        ? count + (disposition.whatsappDeliveries ?? []).filter((delivery) => delivery.status === "Gagal").length
        : count;
    }, 0);
  const urgentDispositionCount = pendingInbox.filter((d) => d.urgent).length;
  const taskPreviewItems = sortTaskItems(taskSources.flatMap((source) => source.tasks), "priority").slice(0, 6);
  const recommendationCandidates = [
    ...accessiblePortalApps.map((app) => ({
      id: `app-${app.id}`,
      title: app.label,
      hint: app.description,
      href: app.href,
      badge: app.badgeLabel ?? "Aplikasi",
    })),
    ...accessibleModules
      .filter((module) => ["dashboard", "surat-masuk", "disposisi", "search"].includes(module.id))
      .map((module) => ({
        id: `module-${module.id}`,
        title: module.label,
        hint: module.description,
        href: module.href,
        badge: "Shortcut",
      })),
  ].filter((item, index, array) => array.findIndex((candidate) => candidate.href === item.href) === index);
  const fallbackTiles = recommendationCandidates
    .concat([
      {
        id: "fallback-surat",
        title: "Manajemen Surat",
        hint: "Masuk ke sub-modul persuratan ALETA untuk surat masuk, surat keluar, dan disposisi.",
        href: "/manajemen-surat",
        badge: "Rekomendasi",
      },
      {
        id: "fallback-masuk",
        title: "Surat Masuk",
        hint: "Buka daftar surat masuk untuk memeriksa registrasi, disposisi, dan notifikasi.",
        href: "/surat?type=masuk",
        badge: "Rekomendasi",
      },
      {
        id: "fallback-search",
        title: "Pencarian Global",
        hint: "Gunakan pencarian cepat ALETA untuk menemukan surat, disposisi, dan akun terkait.",
        href: "/search",
        badge: "Rekomendasi",
      },
    ])
    .filter((item, index, array) => array.findIndex((candidate) => candidate.href === item.href) === index)
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Portal ALETA"
        title="ALETA"
        description={`ALETA adalah portal terpadu seluruh aplikasi. Peran aktif Anda ${currentRoleBadge} pada ${position?.name}, dengan Manajemen Surat sebagai aplikasi utama untuk pekerjaan persuratan.`}
      />

      <WorkSummaryHero
        isAdminTier={isAdminTier}
        currentRoleBadge={currentRoleBadge}
        positionName={position?.name}
        pendingDispositionCount={pendingInbox.length}
        newLetterCount={newIncomingCount}
        failedWaCount={failedWhatsappCount}
        urgentCount={urgentDispositionCount}
        taskSources={taskSources}
        taskSummary={taskSummary}
        quickActions={fallbackTiles}
      />

      <div className="grid gap-6">
        <Card className="border-border/80">
          <CardContent className="space-y-5 p-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Grid Aplikasi ALETA</p>
              <h3 className="font-serif text-2xl text-foreground">Aplikasi Tersedia</h3>
              <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
                Aplikasi utama ditampilkan lebih awal agar pengguna bisa langsung memilih area kerja yang relevan tanpa menelusuri seluruh portal.
              </p>
            </div>
            <MainAppHub apps={accessiblePortalApps} />
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-slate-50/50 dark:bg-slate-900/10">
          <CardContent className="space-y-6 p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-primary">
                  <BellRing className="h-4 w-4" />
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em]">Pusat Tugas & Notifikasi</p>
                </div>
                <h3 className="font-serif text-2xl text-foreground">Tugas & Aktivitas Mendesak</h3>
                <p className="text-sm text-muted-foreground">Ada {globalTaskCount} tugas yang memerlukan perhatian Anda hari ini.</p>
              </div>
              <Button variant="outline" size="sm" asChild className="rounded-xl border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-colors">
                <Link href="/tugas">
                  Lihat Semua
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {taskPreviewItems.map((task) => {
                const visual = taskVisuals[task.sourceType];
                const Icon = visual.icon;
                return (
                  <Link
                    key={task.id}
                    href={task.href}
                    className="group flex items-start gap-4 rounded-[1.6rem] border border-border/50 bg-card p-5 transition hover:border-primary/40 hover:shadow-panel"
                  >
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${visual.iconBg} ${visual.iconColor}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge className={`h-5 px-1.5 text-[10px] uppercase tracking-wider ${visual.badgeClassName ?? ""}`}>
                            {task.status ?? task.sourceLabel}
                          </Badge>
                          {task.priority === "urgent" ? (
                            <Badge variant="danger" className="h-5 px-1.5 text-[10px] uppercase tracking-wider">
                              Mendesak
                            </Badge>
                          ) : null}
                          {!task.seen ? (
                            <Badge variant="default" className="h-5 px-1.5 text-[10px] uppercase tracking-wider">
                              Baru
                            </Badge>
                          ) : null}
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(task.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                        </span>
                      </div>
                      <p className="truncate text-base font-bold text-foreground group-hover:text-primary transition-colors">
                        {task.title}
                      </p>
                      <p className="line-clamp-1 text-xs text-muted-foreground">{task.description ?? task.sourceLabel}</p>
                    </div>
                  </Link>
                );
              })}

              {taskPreviewItems.length === 0 ? (
                <div className="rounded-[1.6rem] border border-dashed border-border/70 bg-card p-5 text-sm text-muted-foreground">
                  Tidak ada tugas lintas aplikasi yang perlu ditindaklanjuti.
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
