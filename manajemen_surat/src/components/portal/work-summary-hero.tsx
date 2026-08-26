"use client";

import Link from "next/link";
import { ArrowRight, BellRing, CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { TaskSource, TaskSummary } from "@/lib/task-sources";

type QuickActionTile = {
  id: string;
  title: string;
  hint: string;
  href: string;
  badge: string;
};

type WorkSummaryHeroProps = {
  isAdminTier: boolean;
  currentRoleBadge: string;
  positionName?: string;
  pendingDispositionCount: number;
  newLetterCount: number;
  failedWaCount: number;
  urgentCount: number;
  taskSources?: TaskSource[];
  taskSummary?: TaskSummary;
  quickActions: QuickActionTile[];
};

export function WorkSummaryHero({
  isAdminTier,
  currentRoleBadge,
  positionName,
  pendingDispositionCount,
  newLetterCount,
  failedWaCount,
  urgentCount,
  taskSources,
  taskSummary,
  quickActions,
}: WorkSummaryHeroProps) {
  const mailSource = taskSources?.find((source) => source.appId === "manajemen-surat");
  const botSource = taskSources?.find((source) => source.appId === "aleta-bot");
  const hrSource = taskSources?.find((source) => source.appId === "e-kepegawaian");
  const eStatusSource = taskSources?.find((source) => source.appId === "e-status");
  const feedbackSource = taskSources?.find((source) => source.appId === "feedback");
  const adminSource = taskSources?.find((source) => source.appId === "admin");
  const taskTiles = [
    {
      id: "tile-disposisi",
      label: "Manajemen Surat",
      value: mailSource?.count ?? pendingDispositionCount + newLetterCount,
      href: "/tugas?source=manajemen-surat",
    },
    {
      id: "tile-aleta-bot",
      label: "ALETA Bot",
      value: botSource?.count ?? failedWaCount,
      href: "/tugas?source=aleta-bot",
    },
    {
      id: "tile-e-kepegawaian",
      label: "E-Kepegawaian",
      value: hrSource?.count ?? 0,
      href: "/tugas?source=e-kepegawaian",
    },
    {
      id: "tile-e-status",
      label: "E-Status",
      value: eStatusSource?.count ?? 0,
      href: "/tugas?source=e-status",
    },
    {
      id: "tile-feedback",
      label: "Masukan pengguna",
      value: feedbackSource?.count ?? 0,
      href: "/tugas?source=feedback",
    },
    ...(isAdminTier
      ? [
          {
            id: "tile-admin",
            label: "Admin Panel",
            value: adminSource?.count ?? 0,
            href: "/tugas?source=admin",
          },
        ]
      : []),
  ];
  const totalTaskCount = taskSummary?.total ?? pendingDispositionCount + newLetterCount + failedWaCount;
  const urgentTaskCount = taskSummary?.urgent ?? urgentCount;

  return (
    <Card className="overflow-hidden border-primary/20 bg-[linear-gradient(135deg,rgba(5,26,43,0.98),rgba(20,93,137,0.94))] text-white shadow-[0_22px_60px_rgba(5,26,43,0.26)] dark:border-primary/20 dark:bg-[linear-gradient(135deg,rgba(4,18,31,0.98),rgba(10,49,74,0.95))]">
      <CardContent className="grid gap-4 p-4 lg:grid-cols-[1.02fr_0.98fr] lg:p-5">
        <div className="space-y-3">
          <Badge variant="outline" className="w-fit border-amber-200/25 bg-amber-200/10 text-amber-50">
            Ringkasan Kerja
          </Badge>
          <h2 className="font-serif text-xl leading-tight sm:text-2xl">
            {isAdminTier
              ? "Menu kerja, tugas penting, dan layanan kantor dalam satu tempat."
              : "Menu yang sesuai dengan pekerjaan Anda."}
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-slate-200">
            {totalTaskCount > 0
              ? `Ada ${totalTaskCount} hal yang perlu dicek.`
              : `Belum ada tugas penting untuk ${currentRoleBadge}${positionName ? ` pada ${positionName}` : ""}.`}
          </p>
          {isAdminTier ? (
            <Button
              variant="outline"
              className="group h-9 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white rounded-2xl px-5 text-sm transition-all duration-300"
              asChild
            >
              <Link href="/admin">
                Panel Admin
                <ArrowRight className="ml-1.5 h-3.5 w-3.5 transition group-hover:translate-x-1" />
              </Link>
            </Button>
          ) : null}
        </div>

        <div className="space-y-3">
          {totalTaskCount === 0 ? (
            <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <div>
                <p className="text-sm font-semibold text-white">Tidak ada tugas mendesak</p>
                <p className="text-xs text-slate-300">Semua tugas penting sudah ditangani.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {taskTiles.map((tile) => (
                <Link
                  key={tile.id}
                  href={tile.href}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-white/10 px-4 py-2.5 text-sm transition hover:bg-white/15"
                >
                  <span className="text-slate-200">{tile.label}</span>
                  <div className="flex items-center gap-2">
                    {tile.value > 0 ? (
                      <span className="min-w-[1.75rem] rounded-xl bg-white/20 px-2 py-0.5 text-center text-sm font-semibold text-white">
                        {tile.value}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                    <ArrowRight className="h-3 w-3 text-slate-400" />
                  </div>
                </Link>
              ))}
              {urgentTaskCount > 0 ? (
              <div className="flex items-center gap-2 rounded-2xl border border-amber-300/35 bg-amber-300/10 px-4 py-2 text-xs text-amber-100">
                  <BellRing className="h-3 w-3 shrink-0" />
                  Ada {urgentTaskCount} tugas mendesak yang perlu segera dicek.
                </div>
              ) : null}
            </div>
          )}

          <div className="hidden gap-1.5 rounded-[1.5rem] border border-white/10 bg-white/5 p-2 sm:grid sm:grid-cols-3">
            {quickActions.map((tile) => (
              <Link
                key={tile.id}
                href={tile.href}
            className="rounded-xl border border-white/10 bg-white/10 p-3 transition hover:border-amber-200/25 hover:bg-white/15"
              >
                <Badge variant="outline" className="border-white/20 bg-white/10 text-[10px] text-white">
                  {tile.badge}
                </Badge>
                <p className="mt-2 text-sm font-semibold text-white">{tile.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-300">{tile.hint}</p>
              </Link>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
