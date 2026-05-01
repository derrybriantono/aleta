"use client";

import Link from "next/link";
import { ArrowRight, BellRing, CheckCircle2, ListTodo, Send } from "lucide-react";

import { MainAppHub } from "@/components/portal/main-app-hub";
import { PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  const hasUrgentDisposition = pendingInbox.some((d) => d.urgent);
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

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Portal ALETA"
        title="ALETA"
        description={`ALETA adalah portal terpadu seluruh aplikasi. Role aktif Anda ${currentRoleBadge} pada ${position?.name}, dengan Manajemen Surat sebagai sub-aplikasi utama untuk pekerjaan persuratan.`}
      />

      <Card className="overflow-hidden border-border/80 bg-[linear-gradient(135deg,rgba(15,43,66,0.98),rgba(21,74,115,0.95))] text-white dark:border-slate-700/70 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(30,41,59,0.96))]">
        <CardContent className="grid gap-4 p-4 lg:grid-cols-[1.02fr_0.98fr] lg:p-5">
          {/* Left: identity + role context */}
          <div className="space-y-3">
            <Badge variant="outline" className="w-fit border-white/20 bg-white/10 text-white">
              Ringkasan Kerja
            </Badge>
            <h2 className="font-serif text-2xl leading-tight">
              {isAdminTier
                ? "ALETA menjadi hub utama untuk modul kerja, kontrol layanan, dan navigasi lintas ekosistem."
                : "ALETA memusatkan aplikasi yang paling relevan dengan peran kerja Anda."}
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-slate-200">
              {totalTaskCount > 0
                ? `Ada ${totalTaskCount} item yang memerlukan perhatian Anda.`
                : "Ringkasan tugas aktif dan akses cepat ke area yang relevan berdasarkan peran Anda."}
            </p>
            {isAdminTier && (
              <Button
                variant="outline"
                className="group h-9 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white rounded-2xl px-5 text-sm transition-all duration-300"
                asChild
              >
                <Link href="/admin">
                  Pengaturan
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5 transition group-hover:translate-x-1" />
                </Link>
              </Button>
            )}
          </div>

          {/* Right: task summary + quick actions */}
          <div className="space-y-3">
            {/* Task breakdown — live data, each row is a link */}
            {totalTaskCount === 0 ? (
              <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                <div>
                  <p className="text-sm font-semibold text-white">Tidak ada tugas mendesak</p>
                  <p className="text-xs text-slate-300">Semua disposisi dan surat sudah ditangani.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                {taskTiles.map((tile) => (
                  <Link
                    key={tile.id}
                    href={tile.href}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-white/10 px-4 py-2.5 text-sm transition hover:bg-white/15"
                  >
                    <span className="text-slate-200">{tile.label}</span>
                    <div className="flex items-center gap-2">
                      {tile.value > 0 ? (
                        <span className="min-w-[1.75rem] rounded-xl bg-white/20 px-2 py-0.5 text-center text-sm font-semibold text-white">
                          {tile.value}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                      <ArrowRight className="h-3 w-3 text-slate-400" />
                    </div>
                  </Link>
                ))}
                {hasUrgentDisposition && (
                  <div className="flex items-center gap-2 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-xs text-amber-200">
                    <BellRing className="h-3 w-3 shrink-0" />
                    Ada disposisi urgent yang perlu segera ditindaklanjuti.
                  </div>
                )}
              </div>
            )}

            {/* Quick actions — role-based via fallbackTiles, max 3 */}
            <div className="grid gap-1.5 rounded-[1.5rem] border border-white/10 bg-white/5 p-2 sm:grid-cols-3">
              {fallbackTiles.map((tile) => (
                <Link
                  key={tile.id}
                  href={tile.href}
                  className="rounded-xl border border-white/10 bg-white/10 p-3 transition hover:bg-white/15"
                >
                  <Badge variant="outline" className="border-white/20 bg-white/10 text-[10px] text-white">
                    {tile.badge}
                  </Badge>
                  <p className="mt-2 text-sm font-semibold text-white">{tile.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-300">{tile.hint}</p>
                </Link>
              ))}
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
