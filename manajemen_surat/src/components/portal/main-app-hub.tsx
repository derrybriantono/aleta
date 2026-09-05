"use client";

import Link from "next/link";
import {
  Archive,
  ArrowRight,
  BookOpenText,
  Bot,
  BriefcaseBusiness,
  Database,
  FileText,
  Inbox,
  LibraryBig,
  MessageCircleMore,
  Scale,
  ScrollText,
  UsersRound,
  Wallet,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { type PortalAppConfig } from "@/lib/types";
import { cn } from "@/lib/utils";

const iconMap = {
  inbox: Inbox,
  "briefcase-business": BriefcaseBusiness,
  wallet: Wallet,
  "book-open-text": BookOpenText,
  "library-big": LibraryBig,
  "scroll-text": ScrollText,
  "message-circle-more": MessageCircleMore,
  scale: Scale,
  archive: Archive,
  "users-round": UsersRound,
  bot: Bot,
  database: Database,
  "file-text": FileText,
};

export function MainAppHub({ apps }: { apps: PortalAppConfig[] }) {
  return (
    <div className="grid gap-2 sm:gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {apps.map((app) => {
        const Icon = iconMap[app.icon as keyof typeof iconMap] ?? Inbox;

        return (
          <Link key={app.id} href={app.href} data-testid={`hub-module-${app.id}`}>
            <Card
              className={cn(
                "group h-full border-border/80 bg-card/80 transition duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-panel"
              )}
            >
              <CardContent className="flex h-full flex-row items-center gap-3 p-3 text-left sm:flex-col sm:items-start sm:gap-4 sm:p-5">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/70 shadow-sm sm:h-14 sm:w-14 sm:rounded-2xl",
                    app.iconBgClass ?? "bg-muted",
                    app.iconFgClass ?? "text-primary"
                  )}
                >
                  <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>

                <div className="min-w-0 flex-1 space-y-1 sm:space-y-1.5">
                  <p className="text-base font-semibold leading-6 text-foreground">{app.label}</p>
                  <p className="hidden text-sm leading-6 text-muted-foreground sm:block">{app.description}</p>
                </div>

                <div className="ml-auto flex items-center gap-2 sm:mt-auto sm:ml-0 sm:w-full sm:justify-between sm:gap-3">
                  <Badge variant={app.isDummy ? "muted" : "default"} className="hidden sm:inline-flex">
                    {app.badgeLabel ?? "Aplikasi"}
                  </Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
