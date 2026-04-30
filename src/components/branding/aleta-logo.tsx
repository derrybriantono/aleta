"use client";

import Image from "next/image";

import { cn } from "@/lib/utils";

export function AletaLogo({
  title = "ALETA",
  subtitle,
  size = "md",
  className,
}: {
  title?: string;
  subtitle?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const imageSize = size === "sm" ? 40 : size === "lg" ? 64 : 52;
  const titleClass = size === "sm" ? "text-base" : size === "lg" ? "text-2xl" : "text-xl";
  const subtitleClass = size === "sm" ? "text-[11px]" : "text-xs";

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex shrink-0 items-center justify-center">
        <Image
          src="/mahkamah-agung-logo.png"
          alt="Logo Mahkamah Agung Republik Indonesia"
          width={imageSize}
          height={imageSize}
          className="object-contain drop-shadow-[0_4px_12px_rgba(15,23,42,0.16)] dark:drop-shadow-[0_4px_12px_rgba(15,23,42,0.3)]"
        />
      </div>
      <div className="min-w-0 leading-tight">
        <p className={cn("font-serif font-semibold text-foreground", titleClass)}>{title}</p>
        {subtitle ? <p className={cn("mt-1 text-muted-foreground", subtitleClass)}>{subtitle}</p> : null}
      </div>
    </div>
  );
}
