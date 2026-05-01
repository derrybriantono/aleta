"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Clock, ListTodo, LoaderCircle, MessageCircleMore, Send, ShieldCheck } from "lucide-react";

import { PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePortal } from "@/lib/app-state";
import { sortTaskItems, type TaskItem, type TaskSource } from "@/lib/task-sources";
import { cn } from "@/lib/utils";

type TaskFilter = "all" | "manajemen-surat" | "aleta-bot" | "feedback" | "admin" | "urgent" | "unseen";
type TaskSort = "priority" | "newest" | "oldest" | "unread";

const filterOptions: Array<{ id: TaskFilter; label: string }> = [
  { id: "all", label: "Semua" },
  { id: "manajemen-surat", label: "Manajemen Surat" },
  { id: "aleta-bot", label: "ALETA Bot" },
  { id: "feedback", label: "Pusat Masukan" },
  { id: "admin", label: "Persetujuan" },
  { id: "urgent", label: "Mendesak" },
  { id: "unseen", label: "Belum Dilihat" },
];

const sortOptions: Array<{ id: TaskSort; label: string }> = [
  { id: "priority", label: "Prioritas tertinggi dulu" },
  { id: "newest", label: "Terbaru dulu" },
  { id: "oldest", label: "Terlama dulu" },
  { id: "unread", label: "Belum dilihat dulu" },
];

const taskVisuals: Record<TaskItem["sourceType"], {
  icon: typeof ListTodo;
  iconColor: string;
  iconBg: string;
  badgeVariant: "default" | "warning" | "danger";
  badgeClassName?: string;
}> = {
  disposition: {
    icon: ListTodo,
    iconColor: "text-amber-600",
    iconBg: "bg-amber-100 dark:bg-amber-900/30",
    badgeVariant: "warning",
  },
  letter: {
    icon: Send,
    iconColor: "text-indigo-600",
    iconBg: "bg-indigo-100 dark:bg-indigo-900/30",
    badgeVariant: "default",
    badgeClassName: "bg-indigo-500",
  },
  wa_failed: {
    icon: MessageCircleMore,
    iconColor: "text-rose-600",
    iconBg: "bg-rose-100 dark:bg-rose-950/40",
    badgeVariant: "danger",
  },
  system_task: {
    icon: MessageCircleMore,
    iconColor: "text-slate-600",
    iconBg: "bg-slate-100 dark:bg-slate-900/40",
    badgeVariant: "default",
  },
  feedback: {
    icon: MessageCircleMore,
    iconColor: "text-sky-600",
    iconBg: "bg-sky-100 dark:bg-sky-950/40",
    badgeVariant: "default",
    badgeClassName: "bg-sky-500",
  },
  approval: {
    icon: ShieldCheck,
    iconColor: "text-violet-600",
    iconBg: "bg-violet-100 dark:bg-violet-950/40",
    badgeVariant: "warning",
  },
};

function filterSourceTasks(source: TaskSource, filter: TaskFilter): TaskSource | null {
  if (filter === "manajemen-surat" && source.appId !== "manajemen-surat") return null;
  if (filter === "aleta-bot" && source.appId !== "aleta-bot") return null;
  if (filter === "feedback" && source.appId !== "feedback") return null;
  if (filter === "admin" && source.appId !== "admin") return null;

  const tasks = source.tasks.filter((task) => {
    if (filter === "urgent") return task.priority === "urgent";
    if (filter === "unseen") return !task.seen;
    return true;
  });

  if (tasks.length === 0) return null;

  return {
    ...source,
    count: tasks.length,
    tasks,
  };
}

export default function TugasPage() {
  const searchParams = useSearchParams();
  const {
    isSyncing,
    markTaskItemsSeen,
    taskSources,
  } = usePortal();
  const initialSource = searchParams.get("source");
  const [activeFilter, setActiveFilter] = useState<TaskFilter>(
    initialSource === "manajemen-surat" ||
      initialSource === "aleta-bot" ||
      initialSource === "feedback" ||
      initialSource === "admin"
      ? initialSource
      : "all"
  );
  const [sortMode, setSortMode] = useState<TaskSort>("priority");

  const visibleTaskSources = useMemo(
    () =>
      taskSources
        .map((source) => filterSourceTasks(source, activeFilter))
        .filter((source): source is TaskSource => Boolean(source))
        .map((source) => ({
          ...source,
          tasks: sortTaskItems(source.tasks, sortMode),
        })),
    [activeFilter, sortMode, taskSources]
  );
  const unseenVisibleTasks = visibleTaskSources.flatMap((source) => source.tasks).filter((task) => !task.seen);

  const hasTasks = visibleTaskSources.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="rounded-full">
          <Link href="/portal">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <PageIntro
          eyebrow="Aktivitas Global"
          title="Pusat Tugas & Notifikasi"
          description="Pantau semua tugas mendesak dari berbagai aplikasi kerja Anda dalam satu pusat kendali terpadu."
        />
      </div>

      <Card className="border-border/70">
        <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((option) => (
              <Button
                key={option.id}
                type="button"
                size="sm"
                variant={activeFilter === option.id ? "default" : "outline"}
                className="rounded-full"
                onClick={() => setActiveFilter(option.id)}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:flex-row sm:items-center">
            Urutkan
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as TaskSort)}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm normal-case tracking-normal text-foreground"
            >
              {sortOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {unseenVisibleTasks.length > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() =>
                markTaskItemsSeen(
                  unseenVisibleTasks.map((task) => ({ entityType: task.entityType, entityId: task.entityId }))
                )
              }
            >
              Tandai Semua Sudah Dilihat
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {isSyncing ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="border-border/60">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted">
                    <LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 w-28 rounded-full bg-muted" />
                    <div className="h-3 w-40 rounded-full bg-muted/70" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">Memuat tugas...</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !hasTasks ? (
        <Card className="flex flex-col items-center justify-center border-dashed py-20 text-center">
          <div className="rounded-full bg-primary/10 p-6 text-primary">
            <CheckCircle2 className="h-12 w-12" />
          </div>
          <h3 className="mt-6 font-serif text-2xl text-foreground">Semua Tugas Selesai!</h3>
          <p className="mt-2 max-w-xs text-muted-foreground">
            {activeFilter === "all"
              ? "Tidak ada tugas mendesak dari aplikasi mana pun yang memerlukan perhatian Anda."
              : "Tidak ada tugas untuk filter ini."}
          </p>
          <Button asChild className="mt-8" variant="outline">
            <Link href="/portal">Kembali ke Dashboard</Link>
          </Button>
        </Card>
      ) : (
        <div className="space-y-10">
          {visibleTaskSources.map((source) => (
            <section key={source.appId} className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  <h3 className="font-serif text-xl font-bold">{source.appName}</h3>
                </div>
                <Badge variant="outline" className="rounded-full bg-muted/50">
                  {source.count} Tugas
                </Badge>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {source.tasks.map((task) => {
                  const visual = taskVisuals[task.sourceType];
                  const Icon = visual.icon;
                  return (
                    <Link key={task.id} href={task.href} className="group block">
                      <Card className="h-full border-border/60 transition hover:border-primary/40 hover:shadow-panel overflow-hidden">
                        <CardContent className="flex h-full flex-col p-0">
                          <div className="p-5 flex-1 space-y-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className={cn(visual.iconBg, visual.iconColor, "rounded-2xl p-2.5")}>
                                <Icon className="h-5 w-5" />
                              </div>
                              <div className="flex flex-wrap justify-end gap-1.5">
                                <Badge variant={visual.badgeVariant} className={visual.badgeClassName}>
                                  {task.status ?? "Tugas"}
                                </Badge>
                                {task.priority === "urgent" ? <Badge variant="danger">Mendesak</Badge> : null}
                                {task.seen === false ? <Badge variant="default">Belum Dilihat</Badge> : null}
                              </div>
                            </div>

                            <div className="space-y-1">
                              <p className="font-bold text-lg leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2">
                                {task.title}
                              </p>
                              <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>
                            </div>
                          </div>

                          <div className="px-5 py-3 bg-muted/30 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
                            <span className="truncate max-w-[150px]">{task.footer}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <Clock className="h-3 w-3" />
                              <span>{new Date(task.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
