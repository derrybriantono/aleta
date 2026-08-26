"use client";

import Image from "next/image";

import { getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";

export function UserAvatar({
  name,
  profilePhotoUrl,
  className,
  textClassName,
}: {
  name: string;
  profilePhotoUrl?: string;
  className?: string;
  textClassName?: string;
}) {
  if (profilePhotoUrl) {
    return (
      <Image
        src={profilePhotoUrl}
        alt={`Foto profil ${name}`}
        width={48}
        height={48}
        unoptimized
        className={cn("h-12 w-12 rounded-2xl object-cover ring-2 ring-border/50", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-300/25 bg-sky-950 text-sm font-bold text-sky-100 shadow-[0_10px_24px_rgba(8,47,73,0.30)] ring-1 ring-white/15",
        className,
        textClassName
      )}
    >
      {getInitials(name)}
    </div>
  );
}
