"use client";

import { Bot, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

export function AletaAIMark({
  label,
  compact,
  className,
}: {
  label?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-[1rem] border border-cyan-300/30 bg-[linear-gradient(135deg,rgba(13,148,136,0.16),rgba(37,99,235,0.18))] text-primary shadow-sm">
        <Bot className="h-4 w-4" />
        <Sparkles className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-background p-[1px] text-cyan-500" />
      </span>
      {!compact && label ? (
        <div className="leading-tight">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">ALETA AI</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      ) : null}
    </div>
  );
}
