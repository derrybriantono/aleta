"use client";

import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  BriefcaseBusiness,
  ClipboardCheck,
  EyeOff,
  ListTodo,
  MessageCircleMore,
  Send,
  Settings,
  ShieldCheck,
} from "lucide-react";

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
  hr_leave: {
    icon: ClipboardCheck,
    iconBg: "bg-emerald-100 dark:bg-emerald-950/40",
    iconColor: "text-emerald-700 dark:text-emerald-300",
    badgeClassName: "bg-emerald-500",
  },
  hr_submission: {
    icon: BriefcaseBusiness,
    iconBg: "bg-cyan-100 dark:bg-cyan-950/40",
    iconColor: "text-cyan-700 dark:text-cyan-300",
    badgeClassName: "bg-cyan-500",
  },
  hr_attendance: {
    icon: ClipboardCheck,
    iconBg: "bg-teal-100 dark:bg-teal-950/40",
    iconColor: "text-teal-700 dark:text-teal-300",
    badgeClassName: "bg-teal-500",
  },
  estatus_record: {
    icon: ClipboardCheck,
    iconBg: "bg-amber-100 dark:bg-amber-950/40",
    iconColor: "text-amber-700 dark:text-amber-300",
  },
  estatus_batch: {
    icon: ShieldCheck,
    iconBg: "bg-blue-100 dark:bg-blue-950/40",
    iconColor: "text-blue-700 dark:text-blue-300",
    badgeClassName: "bg-blue-500",
  },
  estatus_transmission: {
    icon: Send,
    iconBg: "bg-cyan-100 dark:bg-cyan-950/40",
    iconColor: "text-cyan-700 dark:text-cyan-300",
    badgeClassName: "bg-cyan-500",
  },
  estatus_incident: {
    icon: ShieldCheck,
    iconBg: "bg-rose-100 dark:bg-rose-950/40",
    iconColor: "text-rose-700 dark:text-rose-300",
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
    panelSettings,
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
        hint: "Buka menu surat untuk mengelola surat masuk, surat keluar, dan disposisi.",
        href: "/manajemen-surat",
        badge: "Rekomendasi",
      },
      {
        id: "fallback-masuk",
        title: "Surat Masuk",
        hint: "Cek surat baru dan tindak lanjutnya.",
        href: "/surat?type=masuk",
        badge: "Rekomendasi",
      },
      {
        id: "fallback-search",
        title: "Pencarian",
        hint: "Cari surat, disposisi, atau pengguna dengan cepat.",
        href: "/search",
        badge: "Rekomendasi",
      },
    ])
    .filter((item, index, array) => array.findIndex((candidate) => candidate.href === item.href) === index)
    .slice(0, 3);
  const portalCards = panelSettings.portalCards;
  const hasVisiblePortalCard = portalCards.workSummary || portalCards.mainMenu || portalCards.importantTasks;

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Portal"
        title="Menu Kerja"
        description={`${currentRoleBadge}${position?.name ? ` · ${position.name}` : ""}`}
      />

      {/* Ringkasan Kerja hanya untuk Super Admin (mode default portal ringkas). */}
      {portalCards.workSummary && effectiveRoleId === "super-admin" ? (
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
      ) : null}

      <div className="grid gap-6">
        {!hasVisiblePortalCard ? (
          <Card className="border-dashed border-border bg-muted/35">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-card p-3 text-muted-foreground">
                  <EyeOff className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-serif text-xl text-foreground">Kartu Portal Disembunyikan</h3>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Admin menonaktifkan seluruh kartu Portal ALETA dari Pengaturan Panel.
                  </p>
                </div>
              </div>
              {isAdminTier ? (
                <Button asChild variant="outline">
                  <Link href="/admin/pengaturan-panel">
                    <Settings className="h-4 w-4" />
                    Atur Panel
                  </Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {portalCards.mainMenu ? (
        <Card className="border-border/80">
          <CardContent className="space-y-4 p-4 sm:space-y-5 sm:p-6">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary sm:text-xs sm:tracking-[0.24em]">Menu</p>
              <h3 className="font-serif text-xl text-foreground sm:text-2xl">Aplikasi yang Bisa Dibuka</h3>
            </div>
            <MainAppHub apps={accessiblePortalApps} />
          </CardContent>
        </Card>
        ) : null}

        {portalCards.importantTasks ? (
        <Card className="portal-subtle-surface border-border/80">
          <CardContent className="space-y-4 p-4 sm:space-y-6 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-primary">
                  <BellRing className="h-4 w-4" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] sm:text-[11px] sm:tracking-[0.2em]">Tugas & Pemberitahuan</p>
                </div>
                <h3 className="font-serif text-xl text-foreground sm:text-2xl">Tugas Penting</h3>
                <p className="hidden text-sm text-muted-foreground sm:block">Ada {globalTaskCount} hal yang perlu dicek hari ini.</p>
              </div>
              <Button variant="outline" size="sm" asChild className="rounded-xl border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-colors">
                <Link href="/tugas">
                  <span className="hidden sm:inline">Lihat Semua</span>
                  <ArrowRight className="h-4 w-4 sm:ml-2" />
                </Link>
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {taskPreviewItems.map((task, index) => {
                const visual = taskVisuals[task.sourceType];
                const Icon = visual.icon;
                return (
                  <Link
                    key={task.id}
                    href={task.href}
                    className={`group items-start gap-3 rounded-[1.1rem] border border-border/50 bg-card p-3 transition hover:border-primary/40 hover:shadow-panel sm:gap-4 sm:rounded-[1.6rem] sm:p-5 ${index > 2 ? "hidden md:flex" : "flex"}`}
                  >
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12 sm:rounded-2xl ${visual.iconBg} ${visual.iconColor}`}>
                      <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
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
                      <p className="truncate text-sm font-bold text-foreground transition-colors group-hover:text-primary sm:text-base">
                        {task.title}
                      </p>
                      <p className="hidden line-clamp-1 text-xs text-muted-foreground sm:block">{task.description ?? task.sourceLabel}</p>
                    </div>
                  </Link>
                );
              })}

              {taskPreviewItems.length === 0 ? (
                <div className="rounded-[1.6rem] border border-dashed border-border/70 bg-card p-5 text-sm text-muted-foreground">
                  Belum ada tugas penting yang perlu dicek.
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
        ) : null}
      </div>
    </div>
  );
}
