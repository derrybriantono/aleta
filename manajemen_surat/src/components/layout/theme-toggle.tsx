"use client";

import { Moon, SunMedium } from "lucide-react";

import { usePortal } from "@/lib/app-state";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, setTheme } = usePortal();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      aria-label={isDark ? "Aktifkan mode terang" : "Aktifkan mode gelap"}
      aria-pressed={isDark}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="relative inline-flex h-12 w-[92px] items-center rounded-full border border-border bg-muted/80 p-1 shadow-sm transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className={cn(
          "absolute top-1 h-10 w-10 rounded-full bg-card shadow-lg transition-transform duration-300",
          isDark ? "translate-x-[42px]" : "translate-x-0"
        )}
      />
      <span className="relative z-10 grid w-full grid-cols-2 items-center">
        <span className="flex items-center justify-center">
          <SunMedium className={cn("h-4 w-4 transition-colors", isDark ? "text-muted-foreground" : "text-orange-500")} />
        </span>
        <span className="flex items-center justify-center">
          <Moon className={cn("h-4 w-4 transition-colors", isDark ? "text-white" : "text-muted-foreground")} />
        </span>
      </span>
    </button>
  );
}
