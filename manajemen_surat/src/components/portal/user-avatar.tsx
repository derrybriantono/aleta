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
    <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary text-sm font-semibold", className, textClassName)}>
      {getInitials(name)}
    </div>
  );
}
