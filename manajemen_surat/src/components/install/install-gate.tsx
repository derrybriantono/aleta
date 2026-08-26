"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { apiPath } from "@/lib/base-path";

type InstallStatusResponse = {
  ok?: boolean;
  data?: {
    setupRequired?: boolean;
  };
};

export function InstallGate() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!pathname || pathname.startsWith("/setup")) return;

    const controller = new AbortController();
    void fetch(apiPath("/api/install"), {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as InstallStatusResponse | null;
        if (response.ok && payload?.ok && payload.data?.setupRequired) {
          router.replace("/setup");
        }
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [pathname, router]);

  return null;
}
