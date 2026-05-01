"use client";

import Link from "next/link";
import {
  Archive,
  ArrowRight,
  BookOpenText,
  Bot,
  BriefcaseBusiness,
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
};

export function MainAppHub({ apps }: { apps: PortalAppConfig[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {apps.map((app) => {
        const Icon = iconMap[app.icon as keyof typeof iconMap] ?? Inbox;

        return (
          <Link key={app.id} href={app.href} data-testid={`hub-module-${app.id}`}>
            <Card
              className={cn(
                "group h-full border transition duration-200 hover:-translate-y-1 hover:shadow-panel",
                app.cardClass ?? "border-border bg-card"
              )}
            >
              <CardContent className="flex h-full flex-col items-start gap-4 p-5 text-left">
                <div
                  className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-2xl border border-border/70 shadow-sm",
                    app.iconBgClass ?? "bg-muted",
                    app.iconFgClass ?? "text-primary"
                  )}
                >
                  <Icon className="h-6 w-6" />
                </div>

                <div className="space-y-1.5">
                  <p className="text-base font-semibold leading-6 text-foreground">{app.label}</p>
                  <p className="text-sm leading-6 text-muted-foreground">{app.description}</p>
                </div>

                <div className="mt-auto flex w-full items-center justify-between gap-3">
                  <Badge variant={app.isDummy ? "muted" : "default"}>{app.badgeLabel ?? "Aplikasi"}</Badge>
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
