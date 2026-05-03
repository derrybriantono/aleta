"use client";

import { Bot, LayoutDashboard, Landmark, MessageCircleMore, Scale, ShieldCheck, Sparkles, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { AletaAIMark } from "@/components/branding/aleta-ai-mark";
import { PageIntro } from "@/components/portal/shared";
import { getWhatsAppRuntimeMessage, useWhatsAppGateway } from "@/components/portal/use-whatsapp-gateway";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePortal } from "@/lib/app-state";
import { getEffectiveRoleId } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export function AdminHub() {
  const { aiConfig, currentUser, institutionIdentity, users } = usePortal();
  const effectiveRoleId = getEffectiveRoleId(currentUser);
  const isSuperAdmin = effectiveRoleId === "super-admin";
  const canReadWhatsAppStatus = effectiveRoleId === "super-admin" || effectiveRoleId === "admin";
  const { snapshot: whatsAppGatewaySnapshot } = useWhatsAppGateway(canReadWhatsAppStatus);
  const [databaseRuntime, setDatabaseRuntime] = useState<{
    activeMode: "postgres" | "fallback";
    postgres: {
      configured: boolean;
      reachable: boolean;
      host: string | null;
      port: number | null;
      database: string | null;
      redactedUrl: string | null;
      lastBootError: string | null;
    };
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadDatabaseRuntime = async () => {
      try {
        const response = await fetch("/api/system/db-status", {
          credentials: "include",
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | {
              ok?: boolean;
              data?: {
                activeMode: "postgres" | "fallback";
                postgres: {
                  configured: boolean;
                  reachable: boolean;
                  host: string | null;
                  port: number | null;
                  database: string | null;
                  redactedUrl: string | null;
                  lastBootError: string | null;
                };
              };
            }
          | null;

        if (!cancelled && response.ok && payload?.ok && payload.data) {
          setDatabaseRuntime(payload.data);
        }
      } catch {
        if (!cancelled) {
          setDatabaseRuntime(null);
        }
      }
    };

    void loadDatabaseRuntime();
    return () => {
      cancelled = true;
    };
  }, []);

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
      value:
        whatsAppGatewaySnapshot.runtimeStatus === "connected"
          ? "Online"
          : whatsAppGatewaySnapshot.runtimeStatus === "waiting_qr"
            ? "Menunggu QR"
            : whatsAppGatewaySnapshot.runtimeStatus === "initializing"
              ? "Inisialisasi"
              : whatsAppGatewaySnapshot.runtimeStatus === "failed"
                ? "Gagal"
                : "Offline",
      hint: getWhatsAppRuntimeMessage(whatsAppGatewaySnapshot.runtimeStatus),
      icon: MessageCircleMore,
      color:
        whatsAppGatewaySnapshot.runtimeStatus === "connected"
          ? "text-emerald-600 dark:text-emerald-400"
          : whatsAppGatewaySnapshot.runtimeStatus === "failed"
            ? "text-rose-600 dark:text-rose-400"
            : "text-amber-600 dark:text-amber-400",
      bgColor:
        whatsAppGatewaySnapshot.runtimeStatus === "connected"
          ? "bg-emerald-100 dark:bg-emerald-500/10"
          : whatsAppGatewaySnapshot.runtimeStatus === "failed"
            ? "bg-rose-100 dark:bg-rose-500/10"
            : "bg-amber-100 dark:bg-amber-500/10",
      href: "/admin/status-whatsapp",
      testId: "admin-stat-whatsapp-value",
    },
    {
        label: "Layanan Database",
      value:
        databaseRuntime?.activeMode === "postgres"
          ? "PostgreSQL"
          : databaseRuntime?.activeMode === "fallback"
            ? "Mode Cadangan"
            : "Memeriksa...",
      hint:
        databaseRuntime?.activeMode === "postgres"
          ? `Terhubung ke ${databaseRuntime.postgres.host}:${databaseRuntime.postgres.port}/${databaseRuntime.postgres.database}.`
          : databaseRuntime?.activeMode === "fallback"
            ? databaseRuntime.postgres.reachable
          ? "Mode cadangan masih aktif walau PostgreSQL merespons. Periksa proses awal layanan."
              : `PostgreSQL belum terjangkau di ${databaseRuntime.postgres.host}:${databaseRuntime.postgres.port}/${databaseRuntime.postgres.database}.`
            : "Status layanan database sedang diperiksa.",
      icon: Wallet,
      color: databaseRuntime?.activeMode === "postgres" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400",
      bgColor: databaseRuntime?.activeMode === "postgres" ? "bg-emerald-100 dark:bg-emerald-500/10" : "bg-amber-100 dark:bg-amber-500/10",
      href: "/admin",
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
                      <p className="text-3xl font-bold text-foreground" data-testid={stat.testId}>
                        {stat.value}
                      </p>
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
      description="Kelola akun personil, pembaruan jabatan, NIP, dan peran sistem."
              badge="Users"
            />
            <AdminMenuAction
              href="/admin/status-whatsapp"
              title="WhatsApp Gateway"
      description="Kelola nomor resmi dan pantau koneksi layanan notifikasi."
              badge="Gateway"
            />
            <AdminMenuAction
              href="/admin/feedback"
              title="Masukan Pengguna"
              description="Tinjau laporan bug, saran fitur, dan usulan aplikasi baru dari pengguna ALETA."
              icon={<MessageCircleMore className="h-5 w-5 text-blue-600" />}
              badge="Feedback"
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
      description="Atur akses tampilan modul dan hak akses fitur berdasarkan peran jabatan."
                badge="Security"
              />
              <AdminMenuAction
                href="/admin/audit-trail"
                title="Audit Trail"
                description="Monitor seluruh perubahan penting sistem dan aktivitas administratif dalam satu jejak audit."
                badge="Super Admin"
              />
              <AdminMenuAction
                href="/admin/aleta-bot"
                title="ALETA Bot"
                description="Kelola bot WhatsApp notifikasi perkara, template pesan, query, log, dan manual test."
                icon={<Bot className="h-5 w-5 text-cyan-600" />}
                badge="Super Admin"
              />
              <AdminMenuAction
                href="/admin/asisten-hakim"
                title="Pengaturan Asisten Hakim"
      description="Atur link AI yudisial dan peran yang dapat melihat Asisten Hakim."
                icon={<Scale className="h-5 w-5 text-violet-600" />}
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
              Perubahan bersifat real-time dan memengaruhi seluruh pengguna. Pastikan data sudah valid.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-semibold text-foreground">Status Infrastruktur</p>
              <p
                className={cn(
                  "text-xs",
                  databaseRuntime?.activeMode === "postgres"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-amber-600 dark:text-amber-400"
                )}
              >
                {databaseRuntime?.activeMode === "postgres"
              ? "Layanan memakai PostgreSQL utama"
                  : databaseRuntime?.activeMode === "fallback"
              ? "Layanan memakai data cadangan persisten"
                    : "Status database sedang diperiksa"}
              </p>
              {databaseRuntime?.activeMode === "fallback" && databaseRuntime.postgres.lastBootError ? (
                <p className="mt-1 max-w-xs text-[11px] leading-5 text-muted-foreground">
                  {databaseRuntime.postgres.lastBootError}
                </p>
              ) : null}
            </div>
            <div className="relative flex h-3 w-3">
              <span
                className={cn(
                  "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                  databaseRuntime?.activeMode === "postgres" ? "bg-emerald-400" : "bg-amber-400"
                )}
              ></span>
              <span
                className={cn(
                  "relative inline-flex h-3 w-3 rounded-full",
                  databaseRuntime?.activeMode === "postgres" ? "bg-emerald-500" : "bg-amber-500"
                )}
              ></span>
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
