"use client";

import { LayoutDashboard, Landmark, MessageCircleMore, ShieldCheck, Sparkles, UserCheck, Users, Wallet } from "lucide-react";
import Link from "next/link";

import { AletaAIMark } from "@/components/branding/aleta-ai-mark";
import { PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePortal } from "@/lib/app-state";
import { getEffectiveRoleId } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export function AdminHub() {
  const { aiConfig, currentUser, institutionIdentity, users, whatsAppWeb } = usePortal();
  const effectiveRoleId = getEffectiveRoleId(currentUser);
  const isSuperAdmin = effectiveRoleId === "super-admin";

  const stats = [
    {
      label: "Pengguna Terdaftar",
      value: users.length,
      hint: "Total akun aktif di dalam ekosistem ALETA.",
      icon: Users,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-100 dark:bg-blue-500/10",
      href: "/admin/mapping-user-jabatan",
    },
    {
      label: "Intelligence Engine",
      value: aiConfig.enabled ? "Aktif" : "Nonaktif",
      hint: aiConfig.enabled ? `${aiConfig.modelId} terhubung.` : "AI dimatikan secara global.",
      icon: Sparkles,
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-100 dark:bg-amber-500/10",
      href: "/admin/pengaturan-ai",
      hidden: !isSuperAdmin,
    },
    {
      label: "WhatsApp Gateway",
      value: whatsAppWeb.status === "active" ? "Online" : "Offline",
      hint: whatsAppWeb.status === "active" ? "Gateway siap mengirim notifikasi." : "Koneksi terputus.",
      icon: MessageCircleMore,
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-100 dark:bg-emerald-500/10",
      href: "/admin/status-whatsapp",
    },
  ].filter((s) => !s.hidden);

  return (
    <div className="space-y-10">
      <PageIntro
        eyebrow="Admin Console"
        title="ALETA Control Tower"
        description="Pusat kendali global untuk mengatur infrastruktur, personil, dan identitas platform ALETA dalam satu workspace profesional."
      />

      {/* Quick Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="group border-border/80 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-panel">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-4">
                    <div className={cn("w-fit rounded-2xl p-3 shadow-sm", stat.bgColor, stat.color)}>
                      <stat.icon className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">{stat.label}</p>
                      <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">{stat.hint}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Sections Grid */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Office Management */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <Landmark className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Manajemen Kantor</h2>
          </div>
          
          <div className="grid gap-4">
            <AdminMenuAction
              href="/admin/identitas-instansi"
              title="Identitas Instansi"
              description="Kelola nama resmi, alamat, logo, dan kanal media sosial resmi pengadilan."
              badge="Core"
            />
            <AdminMenuAction
              href="/admin/mapping-user-jabatan"
              title="Direktori Pengguna"
              description="Kelola akun personil, pembaruan jabatan, NIP, serta sinkronisasi role sistem."
              badge="Users"
            />
            <AdminMenuAction
              href="/admin/status-whatsapp"
              title="WhatsApp Gateway"
              description="Otentikasi nomor resmi dan monitoring detak jantung gateway notifikasi."
              badge="Gateway"
            />
          </div>
        </div>

        {/* Platform Governance (Super Admin) */}
        {isSuperAdmin && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-amber-500/10 p-2 text-amber-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Tata Kelola Platform</h2>
            </div>

            <div className="grid gap-4">
              <AdminMenuAction
                href="/admin/pengaturan-ai"
                title="Intelligence Core"
                description="Konfigurasi LLM, manajemen API Key, dan pengaturan parameter AI ALETA."
                icon={<AletaAIMark compact />}
                badge="Intelligence"
              />
              <AdminMenuAction
                href="/admin/visibility-role"
                title="Kontrol Akses (RBAC)"
                description="Atur visibilitas modul dan hak akses fitur berdasarkan role jabatan."
                badge="Security"
              />
              <AdminMenuAction
                href="/admin/audit-trail"
                title="Audit Trail"
                description="Monitor seluruh perubahan penting sistem dan aktivitas administratif dalam satu jejak audit."
                badge="Super Admin"
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <Card className="border-border/60 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="flex flex-col gap-6 p-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-lg font-semibold text-foreground">{institutionIdentity.courtName}</p>
            <p className="max-w-xl text-sm leading-7 text-muted-foreground">
              Perubahan pada Pusat Kendali ini bersifat real-time dan memengaruhi seluruh pengguna di dalam ekosistem ALETA. Pastikan data yang dimasukkan sudah valid.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-semibold text-foreground">Status Infrastruktur</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">Semua sistem beroperasi normal</p>
            </div>
            <div className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AdminMenuAction({
  href,
  title,
  description,
  badge,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  badge: string;
  icon?: React.ReactNode;
}) {
  return (
    <Link href={href} className="group block">
      <Card className="border-border/80 bg-card transition-all hover:border-primary/40 hover:shadow-panel">
        <CardContent className="flex items-center justify-between gap-4 p-5">
          <div className="flex items-start gap-4">
            {icon ? (
              <div className="mt-1">{icon}</div>
            ) : (
              <div className="mt-1 flex h-2 w-2 rounded-full bg-primary/40 transition-all group-hover:scale-150 group-hover:bg-primary" />
            )}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-bold text-foreground transition group-hover:text-primary">{title}</p>
                <Badge variant="outline" className="h-5 px-1.5 text-[10px] uppercase tracking-wider">{badge}</Badge>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">{description}</p>
            </div>
          </div>
          <div className="rounded-xl border border-border p-2 transition-all group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-panel">
            <LayoutDashboard className="h-4 w-4" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
