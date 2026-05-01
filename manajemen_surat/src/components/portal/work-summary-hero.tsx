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
  const supportTaskCount = taskSources
    ?.filter((source) => source.appId === "feedback" || source.appId === "admin")
    .reduce((total, source) => total + source.count, 0);
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
      id: "tile-support",
      label: "Masukan & persetujuan",
      value: supportTaskCount ?? 0,
      href: "/tugas?source=feedback",
    },
  ];
  const totalTaskCount = taskSummary?.total ?? pendingDispositionCount + newLetterCount + failedWaCount;
  const urgentTaskCount = taskSummary?.urgent ?? urgentCount;

  return (
    <Card className="overflow-hidden border-border/80 bg-[linear-gradient(135deg,rgba(15,43,66,0.98),rgba(21,74,115,0.95))] text-white dark:border-slate-700/70 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(30,41,59,0.96))]">
      <CardContent className="grid gap-4 p-4 lg:grid-cols-[1.02fr_0.98fr] lg:p-5">
        <div className="space-y-3">
          <Badge variant="outline" className="w-fit border-white/20 bg-white/10 text-white">
            Ringkasan Kerja
          </Badge>
          <h2 className="font-serif text-2xl leading-tight">
            {isAdminTier
              ? "ALETA menjadi hub utama untuk modul kerja, kontrol layanan, dan navigasi lintas ekosistem."
              : "ALETA memusatkan aplikasi yang paling relevan dengan peran kerja Anda."}
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-slate-200">
            {totalTaskCount > 0
              ? `Ada ${totalTaskCount} item yang memerlukan perhatian Anda.`
              : `Ringkasan tugas aktif untuk role ${currentRoleBadge}${positionName ? ` pada ${positionName}` : ""}.`}
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
                <p className="text-xs text-slate-300">Semua disposisi dan surat sudah ditangani.</p>
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
                <div className="flex items-center gap-2 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-xs text-amber-200">
                  <BellRing className="h-3 w-3 shrink-0" />
                  Ada {urgentTaskCount} tugas mendesak yang perlu segera ditindaklanjuti.
                </div>
              ) : null}
            </div>
          )}

          <div className="grid gap-1.5 rounded-[1.5rem] border border-white/10 bg-white/5 p-2 sm:grid-cols-3">
            {quickActions.map((tile) => (
              <Link
                key={tile.id}
                href={tile.href}
                className="rounded-xl border border-white/10 bg-white/10 p-3 transition hover:bg-white/15"
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
