"use client";

import Link from "next/link";
import {
  Archive,
  ArrowRight,
  BriefcaseBusiness,
  ChartColumn,
  GitBranchPlus,
  Inbox,
  MessageCircleMore,
  ScrollText,
  Search,
  Send,
  ShieldCheck,
  ShieldUser,
  UsersRound,
  Wallet,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { type ModuleConfig } from "@/lib/types";
import { cn } from "@/lib/utils";

const iconMap = {
  inbox: Inbox,
  send: Send,
  "git-branch-plus": GitBranchPlus,
  search: Search,
  "users-round": UsersRound,
  "shield-check": ShieldCheck,
  "chart-column": ChartColumn,
  "scroll-text": ScrollText,
  "briefcase-business": BriefcaseBusiness,
  wallet: Wallet,
  archive: Archive,
  "shield-user": ShieldUser,
  "message-circle-more": MessageCircleMore,
};

export function AppHub({ modules }: { modules: ModuleConfig[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {modules.map((module) => {
        const Icon = iconMap[module.icon as keyof typeof iconMap] ?? Inbox;

        return (
          <Link key={module.id} href={module.href} data-testid={`hub-module-${module.id}`}>
            <Card
              className={cn(
                "group h-full border transition duration-200 hover:-translate-y-1 hover:shadow-panel",
                module.cardClass ?? "border-slate-200/80 bg-slate-50/70"
              )}
            >
              <CardContent className="flex h-full flex-col gap-4 p-6">
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={cn(
                      "flex h-16 w-16 items-center justify-center rounded-full shadow-sm",
                      module.iconBgClass ?? "bg-white",
                      module.iconFgClass ?? "text-primary"
                    )}
                  >
                    <Icon className="h-7 w-7" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:text-slate-800" />
                </div>

                <div className="space-y-2">
                  <p className="text-base font-semibold text-slate-900">{module.label}</p>
                  <p className="text-sm leading-6 text-muted-foreground">{module.description}</p>
                </div>

                <div className="mt-auto">
                  <Badge variant="outline">{module.badgeLabel ?? "Modul"}</Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
