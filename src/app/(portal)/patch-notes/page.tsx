import { CalendarDays, CheckCircle2, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_VERSION, APP_VERSION_LABEL, PATCH_NOTES, type PatchNote } from "@/lib/patch-notes";

const SECTION_LABELS: Array<{
  key: keyof Pick<PatchNote, "added" | "changed" | "fixed" | "security" | "operationalNotes" | "knownLimitations">;
  title: string;
  description: string;
}> = [
  { key: "added", title: "Baru", description: "Fitur dan modul yang mulai tersedia pada rilis ini." },
  { key: "changed", title: "Perubahan", description: "Perubahan perilaku, UX, dan alur kerja yang perlu diketahui operator." },
  { key: "fixed", title: "Perbaikan", description: "Masalah yang sudah diperbaiki sebelum pilot internal." },
  { key: "security", title: "Keamanan", description: "Penguatan akses, masking, dan pembatasan data sensitif." },
  { key: "operationalNotes", title: "Catatan Operasional", description: "Hal yang perlu diperhatikan saat menjalankan pilot." },
  { key: "knownLimitations", title: "Batasan yang Masih Ada", description: "Batasan sengaja yang belum diselesaikan pada fase pilot." },
];

export default function PatchNotesPage() {
  const current = PATCH_NOTES[0];

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Catatan Pembaruan"
        title="Patch Notes ALETA"
        description="Catatan pembaruan internal untuk aplikasi ALETA."
        actions={
          <Link href="/panduan" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            Baca Panduan Penggunaan
          </Link>
        }
      />

      <Card className="overflow-hidden border-border/80">
        <CardHeader className="border-b border-border/80 bg-muted/30">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="success">Versi saat ini: {APP_VERSION}</Badge>
            <Badge variant="outline">Internal Pilot</Badge>
            <Badge variant="muted">{APP_VERSION_LABEL}</Badge>
          </div>
          <CardTitle className="mt-4 text-2xl">{current.title}</CardTitle>
          <CardDescription className="max-w-4xl text-base leading-7">{current.summary}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 p-5 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-4">
            <CalendarDays className="mb-3 h-5 w-5 text-primary" />
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Tanggal Rilis</p>
            <p className="mt-2 font-semibold text-foreground">{current.date}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <CheckCircle2 className="mb-3 h-5 w-5 text-primary" />
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Status</p>
            <p className="mt-2 font-semibold text-foreground">{current.status} - pilot internal</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <ShieldCheck className="mb-3 h-5 w-5 text-primary" />
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Catatan Keamanan</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Tidak memuat secret, token, QR raw, session WhatsApp, atau password.</p>
          </div>
        </CardContent>
      </Card>

      {PATCH_NOTES.map((note) => (
        <Card key={note.version} className="border-border/80">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{note.version}</Badge>
              <Badge variant="muted">{note.status}</Badge>
            </div>
            <CardTitle>{note.title}</CardTitle>
            <CardDescription>{note.summary}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            {SECTION_LABELS.map((section) => (
              <section key={section.key} className="rounded-2xl border border-border bg-card p-4">
                <h2 className="font-semibold text-foreground">{section.title}</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{section.description}</p>
                <ul className="mt-4 space-y-2 text-sm leading-6 text-muted-foreground">
                  {note[section.key].map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
