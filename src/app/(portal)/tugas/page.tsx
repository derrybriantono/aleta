"use client";

import Link from "next/link";
import { ArrowLeft, BellRing, CheckCircle2, Clock, ListTodo, MessageCircleMore, Send } from "lucide-react";

import { PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { usePortal } from "@/lib/app-state";

export default function TugasPage() {
  const { accessibleLetters, currentUser, dispositions, pendingInbox } = usePortal();

  const newIncomingLetters = accessibleLetters.filter(
    (letter) => letter.type === "masuk" && letter.status === "Baru"
  );

  const failedWhatsappDeliveries = [
    ...accessibleLetters.flatMap((letter) =>
      letter.whatsappDeliveries
        .filter((d) => d.status === "Gagal")
        .map((d) => ({ ...d, type: "Surat" as const, parentId: letter.id, label: letter.perihal }))
    ),
    ...dispositions.flatMap((disposition) => {
      const isRelevant = pendingInbox.some((item) => item.id === disposition.id) || disposition.pengirimId === currentUser?.id;
      if (!isRelevant) return [];

      return (disposition.whatsappDeliveries ?? [])
        .filter((d) => d.status === "Gagal")
        .map((d) => ({ ...d, type: "Disposisi" as const, parentId: disposition.suratId, label: disposition.instruksi }));
    }),
  ];

  const tasksByApp = [
    {
      appId: "manajemen-surat",
      appName: "Manajemen Surat",
      tasks: [
        ...pendingInbox.map(item => {
          const letter = accessibleLetters.find(l => l.id === item.suratId);
          return {
            id: item.id,
            title: letter?.perihal ?? "Disposisi Masuk",
            subtitle: `Instruksi: ${item.instruksi}`,
            badge: "Disposisi",
            badgeVariant: "warning" as const,
            href: `/disposisi/${item.id}`,
            date: item.createdAt,
            footer: letter?.pengirim,
            icon: ListTodo,
            iconColor: "text-amber-600",
            iconBg: "bg-amber-100 dark:bg-amber-900/30",
          };
        }),
        ...newIncomingLetters.map(letter => ({
          id: letter.id,
          title: letter.perihal,
          subtitle: `No: ${letter.nomorSurat}`,
          badge: "Surat Baru",
          badgeVariant: "default" as const,
          badgeColor: "bg-indigo-500",
          href: `/surat/${letter.id}`,
          date: letter.tanggal,
          footer: letter.pengirim,
          icon: Send,
          iconColor: "text-indigo-600",
          iconBg: "bg-indigo-100 dark:bg-indigo-900/30",
        })),
        ...failedWhatsappDeliveries.map((delivery, index) => ({
          id: `${delivery.parentId}-${index}`,
          title: `Gagal kirim ke ${delivery.recipientName}`,
          subtitle: `Terkait ${delivery.type}: ${delivery.label}`,
          badge: "WA Retry",
          badgeVariant: "danger" as const,
          href: delivery.type === "Surat" ? `/surat/${delivery.parentId}` : `/disposisi/${delivery.parentId}`,
          date: delivery.lastAttemptAt,
          footer: "Logistics: WhatsApp Gateway",
          icon: MessageCircleMore,
          iconColor: "text-rose-600",
          iconBg: "bg-rose-100 dark:bg-rose-950/40",
        }))
      ]
    }
    // Future apps can be added here
  ].filter(app => app.tasks.length > 0);

  const hasTasks = tasksByApp.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="rounded-full">
          <Link href="/portal">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <PageIntro
          eyebrow="Aktivitas Global"
          title="Pusat Tugas & Notifikasi"
          description="Pantau semua tugas mendesak dari berbagai aplikasi kerja Anda dalam satu pusat kendali terpadu."
        />
      </div>

      {!hasTasks ? (
        <Card className="flex flex-col items-center justify-center border-dashed py-20 text-center">
          <div className="rounded-full bg-primary/10 p-6 text-primary">
            <CheckCircle2 className="h-12 w-12" />
          </div>
          <h3 className="mt-6 font-serif text-2xl text-foreground">Semua Tugas Selesai!</h3>
          <p className="mt-2 max-w-xs text-muted-foreground">
            Tidak ada tugas mendesak dari aplikasi mana pun yang memerlukan perhatian Anda.
          </p>
          <Button asChild className="mt-8" variant="outline">
            <Link href="/portal">Kembali ke Dashboard</Link>
          </Button>
        </Card>
      ) : (
        <div className="space-y-10">
          {tasksByApp.map((app) => (
            <section key={app.appId} className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  <h3 className="font-serif text-xl font-bold">{app.appName}</h3>
                </div>
                <Badge variant="outline" className="rounded-full bg-muted/50">
                  {app.tasks.length} Tugas
                </Badge>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {app.tasks.map((task) => {
                  const Icon = task.icon;
                  return (
                    <Link key={task.id} href={task.href} className="group block">
                      <Card className="h-full border-border/60 transition hover:border-primary/40 hover:shadow-panel overflow-hidden">
                        <CardContent className="flex h-full flex-col p-0">
                          <div className="p-5 flex-1 space-y-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className={task.iconBg + " p-2.5 rounded-2xl " + task.iconColor}>
                                <Icon className="h-5 w-5" />
                              </div>
                              <Badge 
                                variant={task.badgeVariant} 
                                className={task.badgeVariant === "default" && "badgeColor" in task ? (task.badgeColor as string) : ""}
                              >
                                {task.badge}
                              </Badge>
                            </div>
                            
                            <div className="space-y-1">
                              <p className="font-bold text-lg leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2">
                                {task.title}
                              </p>
                              <p className="text-sm text-muted-foreground line-clamp-2">{task.subtitle}</p>
                            </div>
                          </div>

                          <div className="px-5 py-3 bg-muted/30 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
                            <span className="truncate max-w-[150px]">{task.footer}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <Clock className="h-3 w-3" />
                              <span>{new Date(task.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
