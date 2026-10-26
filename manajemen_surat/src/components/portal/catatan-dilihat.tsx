"use client";

import { useEffect, useState } from "react";
import { Eye } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiPath } from "@/lib/base-path";
import type { CatatanDilihat } from "@/server/modules/lihat-sebagai/layanan";

/**
 * "Dilihat oleh Super Admin" di halaman Akun (E4): catatan MILIK SENDIRI saat
 * Super Admin memeriksa menu akun ini. Tidak tampil sama sekali bila belum ada.
 */
export function CatatanDilihatSuperAdmin() {
  const [catatan, setCatatan] = useState<CatatanDilihat[]>([]);

  useEffect(() => {
    let batal = false;
    const t = window.setTimeout(() => {
      void fetch(apiPath("/api/portal/lihat-sebagai/catatan"), { credentials: "include", cache: "no-store" })
        .then((r) => r.json().catch(() => null))
        .then((j: { ok?: boolean; data?: { catatan?: CatatanDilihat[] } } | null) => {
          if (!batal && j?.ok && Array.isArray(j.data?.catatan)) setCatatan(j.data.catatan);
        })
        .catch(() => undefined);
    }, 0);
    return () => {
      batal = true;
      window.clearTimeout(t);
    };
  }, []);

  if (catatan.length === 0) return null;
  return (
    <Card className="bg-card" data-catatan-dilihat>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Eye className="h-4 w-4 text-primary" aria-hidden />
          Dilihat oleh Super Admin
        </CardTitle>
        <CardDescription>Super Admin memeriksa menu dan hak akun Anda (pratinjau baca-saja, tanpa membuka sesi atau data Anda).</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          {catatan.map((c) => (
            <li key={`${c.pada}-${c.oleh}`} className="rounded-xl border border-border p-3">
              <span className="font-medium text-foreground">{c.oleh}</span>
              <span className="text-muted-foreground">
                {" "}
                pada {new Date(c.pada).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Makassar" })} WITA. Alasan: {c.alasan}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
