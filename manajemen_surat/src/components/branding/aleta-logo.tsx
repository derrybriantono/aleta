"use client";

import { useEffect, useState } from "react";

import { getInstitutionLogoSrc } from "@/lib/institution-logo";
import { usePortal } from "@/lib/app-state";
import { cn } from "@/lib/utils";

export function AletaLogo({
  title = "ALETA",
  subtitle,
  size = "md",
  className,
  logoUrl,
}: {
  title?: string;
  subtitle?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  logoUrl?: string;
}) {
  const { institutionIdentity } = usePortal();
  const imageSize = size === "sm" ? 40 : size === "lg" ? 64 : 52;
  const titleClass = size === "sm" ? "text-base" : size === "lg" ? "text-2xl" : "text-xl";
  const subtitleClass = size === "sm" ? "text-[11px]" : "text-xs";
  const logoSrc = getInstitutionLogoSrc(logoUrl ?? institutionIdentity.logoUrl);
  const [failedLogoSrc, setFailedLogoSrc] = useState("");
  const effectiveLogoSrc = failedLogoSrc === logoSrc ? getInstitutionLogoSrc(null) : logoSrc;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFailedLogoSrc("");
    }, 0);

    return () => window.clearTimeout(timer);
  }, [logoSrc]);

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex shrink-0 items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={effectiveLogoSrc}
          src={effectiveLogoSrc}
          alt={`Logo ${title}`}
          width={imageSize}
          height={imageSize}
          className="object-contain drop-shadow-[0_4px_12px_rgba(15,23,42,0.16)] dark:drop-shadow-[0_4px_12px_rgba(15,23,42,0.3)]"
          onError={() => setFailedLogoSrc(logoSrc)}
        />
      </div>
      <div className="min-w-0 leading-tight">
        <p className={cn("font-serif font-semibold text-foreground", titleClass)}>{title}</p>
        {subtitle ? <p className={cn("mt-1 text-muted-foreground", subtitleClass)}>{subtitle}</p> : null}
      </div>
    </div>
  );
}
