"use client";

import Link from "next/link";
import { ArrowLeft, Construction, Sparkles } from "lucide-react";
import { useParams } from "next/navigation";

import { PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePortal } from "@/lib/app-state";

export default function PlaceholderAppPage() {
  const params = useParams<{ slug: string }>();
  const { accessiblePortalApps } = usePortal();
  const app = accessiblePortalApps.find((item) => item.href === `/apps/${params.slug}`);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Dummy App"
        title={app?.label ?? "Aplikasi Portal"}
        description={app?.description ?? "Halaman placeholder untuk aplikasi portal yang belum aktif pada frontend v1."}
      />

      <Card className="border-border/80">
        <CardContent className="grid gap-6 p-6 lg:grid-cols-[0.95fr_1.05fr] lg:p-8">
          <div className="space-y-4">
            <Badge variant="muted" className="w-fit">
              Belum aktif
            </Badge>
            <h2 className="font-serif text-3xl text-foreground">Shell aplikasi sudah disiapkan, modul inti menyusul</h2>
            <p className="text-sm leading-7 text-muted-foreground">
              Ikon ini sengaja ditampilkan pada ALETA sebagai simulasi struktur multi-aplikasi. Untuk iterasi sekarang, fokus implementasi fungsional tetap berada pada sub-modul `Manajemen Surat`.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/portal">
                  <ArrowLeft className="h-4 w-4" />
                  Kembali ke ALETA
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/manajemen-surat">Buka Manajemen Surat</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-[1.8rem] border border-dashed border-primary/30 bg-primary/5 p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-white p-3 text-primary shadow-sm dark:bg-slate-900">
                <Construction className="h-6 w-6" />
              </div>
              <div className="space-y-3">
                <p className="font-semibold text-foreground">Ruang pengembangan aplikasi</p>
                <p className="text-sm leading-7 text-muted-foreground">
                  Nantinya area ini dapat diisi routing internal, dashboard khusus, statistik, dan hak akses terpisah per aplikasi.
                </p>
                <div className="flex items-center gap-2 text-sm text-primary">
                  <Sparkles className="h-4 w-4" />
                  Struktur portal multi-app sudah siap dikembangkan.
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
