"use client";

import Link from "next/link";
import { ArrowRight, BellRing, BookOpenText, CheckCircle2, Clock, FolderArchive, FolderOpenDot, Grid2X2, ListTodo, Scale, Send, ShieldCheck, Sparkles, Waypoints } from "lucide-react";



import { MainAppHub } from "@/components/portal/main-app-hub";
import { PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { regulationsKnowledgeBase } from "@/core/knowledge/regulations-db";
import { usePortal } from "@/lib/app-state";
import { getEffectivePosition, getEffectiveRoleId, getUserRoleBadge } from "@/lib/permissions";

export default function PortalPage() {
  const { accessibleLetters, accessibleModules, accessiblePortalApps, currentUser, dispositions, pendingInbox, globalTaskCount } = usePortal();
  const position = getEffectivePosition(currentUser);
  const effectiveRoleId = getEffectiveRoleId(currentUser);
  const currentRoleBadge = getUserRoleBadge(currentUser);
  const isAdminTier = effectiveRoleId === "super-admin" || effectiveRoleId === "admin";
  const newIncomingCount = accessibleLetters.filter((letter) => letter.type === "masuk" && letter.status === "Baru").length;
  const failedWhatsappCount =
    accessibleLetters.reduce(
      (count, letter) => count + letter.whatsappDeliveries.filter((delivery) => delivery.status === "Gagal").length,
      0
    ) +
    dispositions.reduce((count, disposition) => {
      const isRelevant = pendingInbox.some((item) => item.id === disposition.id) || disposition.pengirimId === currentUser?.id;

      return isRelevant
        ? count + (disposition.whatsappDeliveries ?? []).filter((delivery) => delivery.status === "Gagal").length
        : count;
    }, 0);
  const taskTiles = [
    {
      id: "tile-disposisi",
      label: "Disposisi aktif",
      value: pendingInbox.length,
      hint: pendingInbox.length === 1 ? "1 disposisi perlu aksi segera." : `${pendingInbox.length} disposisi perlu aksi segera.`,
      href: "/disposisi",
    },
    {
      id: "tile-surat-baru",
      label: "Surat perlu telaah",
      value: newIncomingCount,
      hint: newIncomingCount === 1 ? "1 surat baru menunggu telaah." : `${newIncomingCount} surat baru menunggu telaah.`,
      href: "/surat?type=masuk&status=Baru",
    },
    {
      id: "tile-wa",
      label: "WA perlu retry",
      value: failedWhatsappCount,
      hint:
        failedWhatsappCount === 1
          ? "1 notifikasi WhatsApp perlu dikirim ulang."
          : `${failedWhatsappCount} notifikasi WhatsApp perlu dikirim ulang.`,
      href: "/surat",
    },
  ];
  const totalTaskCount = taskTiles.reduce((count, item) => count + item.value, 0);
  const recommendationCandidates = [
    ...accessiblePortalApps.map((app) => ({
      id: `app-${app.id}`,
      title: app.label,
      hint: app.description,
      href: app.href,
      badge: app.badgeLabel ?? "Aplikasi",
    })),
    ...accessibleModules
      .filter((module) => ["dashboard", "surat-masuk", "disposisi", "search"].includes(module.id))
      .map((module) => ({
        id: `module-${module.id}`,
        title: module.label,
        hint: module.description,
        href: module.href,
        badge: "Shortcut",
      })),
  ].filter((item, index, array) => array.findIndex((candidate) => candidate.href === item.href) === index);
  const fallbackTiles = recommendationCandidates
    .concat([
      {
        id: "fallback-surat",
        title: "Manajemen Surat",
        hint: "Masuk ke sub-modul persuratan ALETA untuk surat masuk, surat keluar, dan disposisi.",
        href: "/manajemen-surat",
        badge: "Rekomendasi",
      },
      {
        id: "fallback-masuk",
        title: "Surat Masuk",
        hint: "Buka daftar surat masuk untuk memeriksa registrasi, disposisi, dan notifikasi.",
        href: "/surat?type=masuk",
        badge: "Rekomendasi",
      },
      {
        id: "fallback-search",
        title: "Pencarian Global",
        hint: "Gunakan pencarian cepat ALETA untuk menemukan surat, disposisi, dan akun terkait.",
        href: "/search",
        badge: "Rekomendasi",
      },
    ])
    .filter((item, index, array) => array.findIndex((candidate) => candidate.href === item.href) === index)
    .slice(0, 3);
  const workspaceTrackerCards = [
    {
      id: "workspace-surat",
      title: "Workspace Surat",
      description: "Masuk ke Manajemen Surat untuk inbox, registrasi, arsip, dan disposisi digital.",
      href: "/manajemen-surat",
      icon: FolderOpenDot,
      badge: "Sub-modul aktif",
    },
    {
      id: "workspace-arsip",
      title: "Arsip & Statistik",
      description: "Buka arsip dan statistik untuk menelusuri surat, memeriksa tren, dan membaca ringkasan kerja.",
      href: "/arsip",
      icon: FolderArchive,
      badge: "Operasional",
    },
    {
      id: "workspace-kb",
      title: "Knowledge Base Regulasi",
      description: "Akses regulasi dan pustaka digital untuk mempercepat telaah surat dan penelusuran dasar hukum.",
      href: "/apps/perpustakaan",
      icon: BookOpenText,
      badge: "Rujukan",
    },
  ];

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="ALETA"
        title="ALETA"
        description={`ALETA adalah induk aplikasi kerja terpadu. Role aktif Anda ${currentRoleBadge} pada ${position?.name}, dengan Manajemen Surat sebagai sub-aplikasi utama untuk pekerjaan persuratan.`}
      />

      <Card className="overflow-hidden border-border/80 bg-[linear-gradient(135deg,rgba(15,43,66,0.98),rgba(21,74,115,0.95))] text-white dark:border-slate-700/70 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(30,41,59,0.96))]">
        <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.02fr_0.98fr] lg:p-8">
          <div className="space-y-4">
            <Badge variant="outline" className="w-fit border-white/20 bg-white/10 text-white">
              Smart Workspace Tracker
            </Badge>
            <h2 className="font-serif text-3xl leading-tight sm:text-[2.3rem]">
              {isAdminTier
                ? "ALETA menjadi hub utama untuk modul kerja, kontrol layanan, dan navigasi lintas ekosistem."
                : "ALETA memusatkan aplikasi yang paling relevan dengan peran kerja Anda."}
            </h2>
            <p className="max-w-2xl text-sm leading-7 text-slate-200">
              Manajemen Surat tetap tampil sebagai sub-aplikasi aktif. Workspace tracker di bawah ini mengarahkan Anda
              ke area kerja yang paling relevan tanpa membuat portal utama terasa padat.
            </p>
            {isAdminTier && (
              <div className="pt-2">
                <Button 
                  variant="outline" 
                  className="group h-11 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white rounded-2xl px-6 transition-all duration-300"
                  asChild
                >
                  <Link href="/admin">
                    Pengaturan
                    <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-1" />
                  </Link>
                </Button>
              </div>
            )}
          </div>

          <div className="grid gap-4">
            <div className="grid gap-3 text-sm text-slate-100 sm:grid-cols-3">
              <div className="rounded-2xl bg-white/10 p-4">
                <div className="flex items-center gap-2 text-slate-200">
                  <Grid2X2 className="h-4 w-4" />
                  Aplikasi
                </div>
                <p className="mt-3 text-3xl font-semibold">{accessiblePortalApps.length}</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4">
                <div className="flex items-center gap-2 text-slate-200">
                  <FolderOpenDot className="h-4 w-4" />
                  Tugas
                </div>
                <p className="mt-3 text-3xl font-semibold">{totalTaskCount}</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4">
                <div className="flex items-center gap-2 text-slate-200">
                  <Scale className="h-4 w-4" />
                  Regulasi
                </div>
                <p className="mt-3 text-3xl font-semibold">{regulationsKnowledgeBase.length}</p>
              </div>
            </div>
            <div className="grid gap-3 rounded-[1.8rem] border border-white/10 bg-white/5 p-4 sm:grid-cols-3">
              {workspaceTrackerCards.map((card) => {
                const Icon = card.icon;

                return (
                  <Link key={card.id} href={card.href} className="rounded-[1.4rem] border border-white/10 bg-white/10 p-4 transition hover:bg-white/15">
                    <div className="flex items-center justify-between gap-3">
                      <Badge variant="outline" className="border-white/20 bg-white/10 text-white">
                        {card.badge}
                      </Badge>
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    <p className="mt-4 text-lg font-semibold text-white">{card.title}</p>
                    <p className="mt-2 text-sm leading-7 text-slate-200">{card.description}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
      
      <div className="grid gap-6">
        <Card className="border-border/80">
          <CardContent className="space-y-5 p-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Grid Aplikasi ALETA</p>
              <h3 className="font-serif text-2xl text-foreground">Aplikasi Tersedia</h3>
              <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
                Aplikasi utama ditampilkan lebih awal agar pengguna bisa langsung memilih area kerja yang relevan tanpa menelusuri seluruh portal.
              </p>
            </div>
            <MainAppHub apps={accessiblePortalApps} />
          </CardContent>
        </Card>

        {/* Section: Pusat Tugas Global */}
        <Card className="border-border/80 bg-slate-50/50 dark:bg-slate-900/10">
          <CardContent className="space-y-6 p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-primary">
                  <BellRing className="h-4 w-4" />
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em]">Pusat Tugas & Notifikasi</p>
                </div>
                <h3 className="font-serif text-2xl text-foreground">Tugas & Aktivitas Mendesak</h3>
                <p className="text-sm text-muted-foreground">Ada {globalTaskCount} tugas yang memerlukan perhatian Anda hari ini.</p>
              </div>
              <Button variant="outline" size="sm" asChild className="rounded-xl border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-colors">
                <Link href="/tugas">
                  Lihat Semua
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pendingInbox.slice(0, 3).map((item) => {
                const letter = accessibleLetters.find((l) => l.id === item.suratId);
                return (
                  <Link 
                    key={item.id} 
                    href={`/disposisi/${item.id}`}
                    className="group flex items-start gap-4 rounded-[1.6rem] border border-border/50 bg-card p-5 transition hover:border-primary/40 hover:shadow-panel"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-500">
                      <ListTodo className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="warning" className="h-5 px-1.5 text-[10px] uppercase tracking-wider">Disposisi</Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(item.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                        </span>
                      </div>
                      <p className="truncate text-base font-bold text-foreground group-hover:text-primary transition-colors">
                        {letter?.perihal ?? "Instruksi: " + item.instruksi}
                      </p>
                      <p className="line-clamp-1 text-xs text-muted-foreground">{item.instruksi}</p>
                    </div>
                  </Link>
                );
              })}

              {accessibleLetters.filter(l => l.type === "masuk" && l.status === "Baru").slice(0, 3).map((letter) => (
                <Link 
                  key={letter.id} 
                  href={`/surat/${letter.id}`}
                  className="group flex items-start gap-4 rounded-[1.6rem] border border-border/50 bg-card p-5 transition hover:border-indigo-400/40 hover:shadow-panel"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-500">
                    <Send className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Badge className="h-5 bg-indigo-500 px-1.5 text-[10px] uppercase tracking-wider">Surat Baru</Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(letter.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                    <p className="truncate text-base font-bold text-foreground group-hover:text-indigo-600 transition-colors">
                      {letter.perihal}
                    </p>
                    <p className="line-clamp-1 text-xs text-muted-foreground">Dari: {letter.pengirim}</p>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
