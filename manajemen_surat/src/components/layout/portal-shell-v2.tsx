"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  Bell,
  BookOpenText,
  Bot,
  BriefcaseBusiness,
  ChartColumn,
  ExternalLink,
  GitBranchPlus,
  Inbox,
  LayoutDashboard,
  Landmark,
  LibraryBig,
  LoaderCircle,
  LogOut,
  Menu,
  MessageCircleMore,
  Scale,
  Search,
  Send,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  Sparkles,
  UserCog,
  UsersRound,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";

import { AletaLogo } from "@/components/branding/aleta-logo";
import { PortalFooter } from "@/components/layout/portal-footer";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserAvatar } from "@/components/portal/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePortal } from "@/lib/app-state";
import { ASSISTANT_JUDGE_PROVIDER_ORDER } from "@/lib/assistant-judge";
import { formatDateTime } from "@/lib/format";
import type { ModuleId } from "@/lib/types";
import {
  findModuleByRoute,
  getEffectiveRoleId,
  getUserPositionLabel,
  getUserRoleBadge,
} from "@/lib/permissions";
import { cn } from "@/lib/utils";

// ─── Icon map ─────────────────────────────────────────────────────────────────

const iconMap = {
  "layout-dashboard": LayoutDashboard,
  archive: Archive,
  "chart-column": ChartColumn,
  inbox: Inbox,
  send: Send,
  "git-branch-plus": GitBranchPlus,
  search: Search,
  "users-round": UsersRound,
  "shield-check": ShieldCheck,
  "briefcase-business": BriefcaseBusiness,
  wallet: Wallet,
  "message-circle-more": MessageCircleMore,
  "book-open-text": BookOpenText,
  "library-big": LibraryBig,
  "user-cog": UserCog,
  landmark: Landmark,
  sparkles: Sparkles,
  bot: Bot,
};

// ─── App context ──────────────────────────────────────────────────────────────

type AppContext =
  | "portal"
  | "manajemen_surat"
  | "aleta_bot"
  | "asisten_hakim"
  | "admin"
  | "patch_notes"
  | "panduan"
  | "feedback"
  | "default";

function getAppContext(pathname: string): AppContext {
  if (pathname === "/portal" || pathname.startsWith("/apps/")) return "portal";
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/aleta-bot")) return "aleta_bot";
  if (pathname.startsWith("/asisten-hakim")) return "asisten_hakim";
  if (pathname === "/patch-notes") return "patch_notes";
  if (pathname === "/panduan") return "panduan";
  if (pathname === "/masukan") return "feedback";
  if (
    pathname === "/dashboard" ||
    pathname === "/manajemen-surat" ||
    pathname.startsWith("/manajemen-surat/") ||
    pathname.startsWith("/penugasan") ||
    pathname === "/surat" ||
    pathname.startsWith("/surat/") ||
    pathname.startsWith("/arsip") ||
    pathname.startsWith("/statistik") ||
    pathname.startsWith("/disposisi") ||
    pathname.startsWith("/search") ||
    pathname.startsWith("/account")
  )
    return "manajemen_surat";
  return "default";
}

function hasSidebarForContext(ctx: AppContext): boolean {
  return (
    ctx === "manajemen_surat" ||
    ctx === "admin" ||
    ctx === "aleta_bot" ||
    ctx === "asisten_hakim" ||
    ctx === "patch_notes" ||
    ctx === "panduan" ||
    ctx === "feedback"
  );
}

// ─── Sidebar module sets ──────────────────────────────────────────────────────

const primarySidebarIds: ReadonlySet<ModuleId> = new Set([
  "dashboard",
  "surat-masuk",
  "surat-keluar",
  "disposisi",
  "penugasan",
  "arsip",
  "statistik",
  "search",
]);
const adminSidebarIds: ReadonlySet<ModuleId> = new Set([
  "mapping-user-jabatan",
  "audit",
  "visibility-role",
  "identity",
  "ai-settings",
  "whatsapp-settings",
  "aleta-bot",
  "feedback",
]);
const DESKTOP_SIDEBAR_STORAGE_KEY = "aleta:portal-sidebar-collapsed";
const primarySidebarOrder = [
  "dashboard",
  "surat-masuk",
  "surat-keluar",
  "disposisi",
  "penugasan",
  "arsip",
  "statistik",
  "search",
] as const;
const primarySidebarOrderMap: ReadonlyMap<ModuleId, number> = new Map(
  primarySidebarOrder.map((id, index) => [id, index] as const)
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function prettifySegment(segment: string) {
  return segment.replace(/-/g, " ");
}

function isAdminRoute(pathname: string) {
  return pathname.startsWith("/admin");
}

function isRouteActive(pathname: string, searchParams: URLSearchParams, href: string) {
  const [targetPath, queryString] = href.split("?");

  if (!queryString) {
    if (targetPath === "/manajemen-surat") return pathname === "/manajemen-surat";
    return pathname === targetPath || pathname.startsWith(`${targetPath}/`);
  }

  if (pathname !== targetPath) return false;

  const targetParams = new URLSearchParams(queryString);
  const type = targetParams.get("type");
  const metric = targetParams.get("metric");

  if (type) return searchParams.get("type") === type;
  if (metric) return searchParams.get("metric") === metric;
  return true;
}

// ─── Context-specific sidebar nav items ──────────────────────────────────────

type StaticNavItem = {
  label: string;
  description?: string;
  href: string;
  external?: boolean;
  icon: React.ElementType;
};

function getSidebarTitle(ctx: AppContext, isAdminArea: boolean): string {
  if (isAdminArea) return "Portal Pengaturan";
  if (ctx === "aleta_bot") return "ALETA Bot";
  if (ctx === "asisten_hakim") return "Asisten Hakim";
  if (ctx === "patch_notes") return "Informasi";
  if (ctx === "panduan") return "Panduan";
  if (ctx === "feedback") return "Pusat Masukan";
  return "Manajemen Surat";
}

function getSidebarSubtitle(ctx: AppContext, isAdminArea: boolean, collapsed: boolean): string | undefined {
  if (collapsed) return undefined;
  if (isAdminArea) return "Pusat Kontrol Global ALETA";
  if (ctx === "aleta_bot") return "Monitor bot dan riwayat pesan";
  if (ctx === "asisten_hakim") return "Asisten AI Yudisial";
  if (ctx === "patch_notes" || ctx === "panduan") return "Rilis & dokumentasi ALETA";
  if (ctx === "feedback") return "Laporan bug dan saran";
  return "Sub-modul aktif di dalam ALETA";
}

function getSidebarDescription(ctx: AppContext, isAdminArea: boolean): string {
  if (isAdminArea)
    return "Kelola identitas instansi, akun pengguna, dan visibilitas platform secara terpusat.";
  if (ctx === "aleta_bot")
    return "Pantau status WhatsApp Bot, antrean pesan, dan riwayat pengiriman notifikasi.";
  if (ctx === "asisten_hakim")
    return "Akses cepat ke asisten AI yudisial yang telah disetujui admin.";
  if (ctx === "patch_notes") return "Catatan pembaruan dan informasi rilis ALETA.";
  if (ctx === "panduan") return "Panduan penggunaan ALETA sesuai role dan hak akses.";
  if (ctx === "feedback")
    return "Kirim laporan bug, saran fitur, atau usulan aplikasi baru tanpa membuka area teknis.";
  return "Inbox, surat, arsip, statistik, dan disposisi dipusatkan dalam satu workspace.";
}

// ─── Main shell component ─────────────────────────────────────────────────────

export function PortalShellV2({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {
    accessibleModules,
    currentUser,
    currentUserId,
    inboxNotificationCount,
    globalTaskCount,
    isHydrated,
    isAuthPending,
    isSyncing,
    syncError,
    markPendingInboxSeen,
    pendingInbox,
    signOut,
    assistantJudgeConfig,
  } = usePortal();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedValue = window.localStorage.getItem(DESKTOP_SIDEBAR_STORAGE_KEY);
    if (storedValue) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDesktopSidebarCollapsed(storedValue === "true");
    }
  }, []);

  useEffect(() => {
    if (!isMounted || typeof window === "undefined") return;
    window.localStorage.setItem(DESKTOP_SIDEBAR_STORAGE_KEY, String(desktopSidebarCollapsed));
  }, [desktopSidebarCollapsed, isMounted]);

  useEffect(() => {
    if (!isHydrated || isAuthPending || isSyncing) return;
    if (!currentUserId && !currentUser) {
      router.replace("/login");
    }
  }, [currentUser, currentUserId, isHydrated, isAuthPending, isSyncing, router]);

  if (!isMounted || !isHydrated || isAuthPending || isSyncing || !currentUser) {
    const isBootStuck = isMounted && isHydrated && !isAuthPending && !isSyncing && !currentUser;

    if (isBootStuck) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
          <div className="w-full max-w-sm space-y-4 rounded-[1.4rem] border border-destructive/30 bg-destructive/5 p-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <p className="font-semibold">Portal gagal dimuat</p>
            </div>
            <p className="text-sm leading-6 text-destructive/80">
              {syncError ??
                "Sesi tidak dapat diverifikasi atau data gagal dimuat dari server. Coba muat ulang halaman atau login ulang."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                Muat Ulang
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  signOut();
                  router.replace("/login");
                }}
              >
                <LogOut className="mr-1.5 h-3.5 w-3.5" />
                Login Ulang
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        {isMounted ? (
          <div className="flex items-center gap-3 rounded-full border border-border bg-card px-5 py-3 text-sm text-muted-foreground shadow-panel">
            <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
            Menyiapkan portal...
          </div>
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card shadow-panel">
            <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        )}
      </div>
    );
  }

  const currentRoleBadge = getUserRoleBadge(currentUser);
  const currentPositionLabel = getUserPositionLabel(currentUser);
  const effectiveRoleId = getEffectiveRoleId(currentUser);
  const isAdminTier = effectiveRoleId === "super-admin" || effectiveRoleId === "admin";
  const isSuperAdmin = effectiveRoleId === "super-admin";

  const appContext = getAppContext(pathname);
  const isAdminArea = isAdminRoute(pathname);
  const hasSidebar = hasSidebarForContext(appContext);
  const suratType = searchParams.get("type");

  const activeModule =
    appContext === "manajemen_surat" || isAdminArea ? findModuleByRoute(pathname) : null;

  const primaryModules = accessibleModules
    .filter((module) => primarySidebarIds.has(module.id))
    .sort(
      (left, right) =>
        (primarySidebarOrderMap.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (primarySidebarOrderMap.get(right.id) ?? Number.MAX_SAFE_INTEGER)
    );
  const adminModules = accessibleModules.filter((module) => adminSidebarIds.has(module.id));

  // ─── Page title / focus / breadcrumb ───────────────────────────────────────

  const pageTitle =
    pathname === "/portal"
      ? "ALETA"
      : pathname === "/aleta-bot"
      ? "ALETA Bot"
      : pathname === "/patch-notes"
      ? "Patch Notes"
      : pathname === "/panduan"
      ? "Panduan Penggunaan"
      : pathname === "/masukan"
      ? "Pusat Masukan ALETA"
      : pathname === "/asisten-hakim"
      ? "Asisten Hakim"
      : pathname === "/admin/feedback"
      ? "Masukan Pengguna"
      : pathname === "/admin/asisten-hakim"
      ? "Pengaturan Asisten Hakim"
      : pathname === "/manajemen-surat"
      ? "Dashboard Manajemen Surat"
      : pathname === "/surat"
      ? suratType === "masuk"
        ? "Surat Masuk"
        : suratType === "keluar"
        ? "Surat Keluar"
        : "Daftar Surat"
      : pathname.startsWith("/apps/")
      ? prettifySegment(pathname.split("/").at(-1) ?? "Aplikasi")
      : isAdminArea
      ? activeModule?.label ?? "Portal Pengaturan Global"
      : activeModule?.label ?? "Manajemen Surat";

  const pageFocus =
    pathname === "/portal"
      ? "App hub, tugas aktif, dan kontrol platform."
      : pathname === "/aleta-bot"
      ? "Status layanan WhatsApp Bot, antrean pesan, dan riwayat pengiriman notifikasi."
      : pathname === "/patch-notes"
      ? "Catatan pembaruan internal dan status rilis ALETA."
      : pathname === "/panduan"
      ? "Panduan penggunaan ALETA sesuai role dan hak akses aktif."
      : pathname === "/masukan"
      ? "Laporan bug, saran fitur, dan usulan aplikasi baru untuk pengembangan ALETA."
      : pathname === "/asisten-hakim"
      ? "Akses cepat ke asisten AI yudisial yang telah disetujui admin."
      : pathname === "/admin/feedback"
      ? "Tinjau, filter, dan tindak lanjuti masukan pengguna ALETA."
      : pathname === "/admin/asisten-hakim"
      ? "Pengaturan link AI yudisial dan role yang dapat melihatnya."
      : pathname === "/manajemen-surat"
      ? "Ringkasan surat, tugas mendesak, dan log aktivitas."
      : pathname === "/surat"
      ? suratType === "masuk"
        ? "Registrasi, filter cepat, dan tindak lanjut surat masuk."
        : suratType === "keluar"
        ? "Registrasi, filter cepat, dan monitoring surat keluar."
        : "Daftar surat lintas tipe dengan filter kerja."
      : pathname.startsWith("/apps/")
      ? "Preview modul aplikasi portal."
      : isAdminArea
      ? "Manajemen infrastruktur, identitas, dan kontrol platform global."
      : "Area kerja aktif sesuai modul yang sedang dibuka.";

  const breadcrumbs =
    pathname === "/portal"
      ? [{ label: "ALETA", href: "/portal" }]
      : pathname === "/aleta-bot"
      ? [
          { label: "ALETA", href: "/portal" },
          { label: "ALETA Bot", href: "/aleta-bot" },
        ]
      : pathname === "/masukan"
      ? [
          { label: "Portal Utama", href: "/portal" },
          { label: "Pusat Masukan ALETA", href: "/masukan" },
        ]
      : isAdminArea
      ? [
          { label: "ALETA", href: "/portal" },
          { label: "Portal Pengaturan", href: "/admin" },
          { label: pageTitle, href: pathname },
        ]
      : [
          { label: "ALETA", href: "/portal" },
          { label: pageTitle, href: pathname },
        ];

  // ─── Sidebar renderer ───────────────────────────────────────────────────────

  const renderSidebar = ({ collapsed, mobile = false }: { collapsed: boolean; mobile?: boolean }) => {
    const sidebarTitle = getSidebarTitle(appContext, isAdminArea);
    const sidebarSubtitle = getSidebarSubtitle(appContext, isAdminArea, collapsed);
    const sidebarDescription = getSidebarDescription(appContext, isAdminArea);

    // Static nav items for non-manajemen_surat / non-admin contexts
    const staticNavForContext = (): StaticNavItem[] => {
      if (appContext === "aleta_bot") {
        const items: StaticNavItem[] = [
          {
            label: "Dashboard ALETA Bot",
            description: "Status bot dan riwayat pengiriman pesan",
            href: "/aleta-bot",
            icon: Bot,
          },
        ];
        if (isSuperAdmin) {
          items.push({
            label: "Pengaturan Admin ALETA Bot",
            description: "Konfigurasi teknis bot — khusus Super Admin",
            href: "/admin/aleta-bot",
            icon: Settings,
          });
        }
        return items;
      }

      if (appContext === "asisten_hakim") {
        const items: StaticNavItem[] = [
          {
            label: "Beranda Asisten Hakim",
            description: "Pilih asisten AI yudisial",
            href: "/asisten-hakim",
            icon: Scale,
          },
        ];
        if (assistantJudgeConfig.enabled) {
          for (const pid of ASSISTANT_JUDGE_PROVIDER_ORDER) {
            const link = assistantJudgeConfig.links[pid];
            if (link?.enabled && link.url) {
              items.push({
                label: link.label ?? pid,
                description: "Buka di tab baru",
                href: link.url,
                external: true,
                icon: Sparkles,
              });
            }
          }
        }
        items.push({
          label: "Panduan Penggunaan",
          description: "Dokumentasi dan panduan ALETA",
          href: "/panduan",
          icon: BookOpenText,
        });
        return items;
      }

      if (appContext === "patch_notes") {
        return [
          {
            label: "Patch Notes",
            description: "Catatan pembaruan rilis ALETA",
            href: "/patch-notes",
            icon: GitBranchPlus,
          },
          {
            label: "Panduan Penggunaan",
            description: "Dokumentasi penggunaan ALETA",
            href: "/panduan",
            icon: BookOpenText,
          },
          {
            label: "Beri Masukan",
            description: "Laporkan bug atau saran fitur",
            href: "/masukan",
            icon: MessageCircleMore,
          },
        ];
      }

      if (appContext === "panduan") {
        return [
          {
            label: "Panduan Penggunaan",
            description: "Dokumentasi penggunaan ALETA",
            href: "/panduan",
            icon: BookOpenText,
          },
          {
            label: "Patch Notes",
            description: "Catatan pembaruan rilis ALETA",
            href: "/patch-notes",
            icon: GitBranchPlus,
          },
          {
            label: "Beri Masukan",
            description: "Laporkan kendala atau ide baru",
            href: "/masukan",
            icon: MessageCircleMore,
          },
        ];
      }

      if (appContext === "feedback") {
        return [
          {
            label: "Beri Masukan",
            description: "Laporan bug, saran fitur, dan usulan aplikasi",
            href: "/masukan",
            icon: MessageCircleMore,
          },
          {
            label: "Panduan Penggunaan",
            description: "Dokumentasi penggunaan ALETA",
            href: "/panduan",
            icon: BookOpenText,
          },
          {
            label: "Patch Notes",
            description: "Catatan pembaruan rilis ALETA",
            href: "/patch-notes",
            icon: GitBranchPlus,
          },
        ];
      }

      return [];
    };

    const staticItems = staticNavForContext();

    return (
      <div
        className={cn(
          "flex h-screen flex-col rounded-[2rem] border border-slate-800/80 bg-slate-950/95 text-slate-100 shadow-panel backdrop-blur transition-all duration-300",
          collapsed ? "px-3 py-5" : "p-5"
        )}
      >
        {/* Top controls */}
        <div className={cn("flex gap-2", collapsed ? "justify-center" : "items-center")}>
          <Button
            asChild
            variant="secondary"
            size={collapsed ? "icon" : "default"}
            className={cn(
              "rounded-2xl bg-white/10 text-white hover:bg-white/15 hover:text-white",
              collapsed ? "h-11 w-11 shrink-0" : "justify-start"
            )}
          >
            <Link
              href="/portal"
              onClick={() => setMobileSidebarOpen(false)}
              title="Kembali ke Portal ALETA"
            >
              <ArrowLeft className="h-4 w-4" />
              {collapsed ? (
                <span className="sr-only">Kembali ke Portal ALETA</span>
              ) : (
                "Kembali ke Portal ALETA"
              )}
            </Link>
          </Button>

          {!mobile ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-11 w-11 shrink-0 rounded-2xl text-white hover:bg-white/10 hover:text-white"
              aria-label={collapsed ? "Bentangkan sidebar" : "Ciutkan sidebar"}
              title={collapsed ? "Bentangkan sidebar" : "Ciutkan sidebar"}
              onClick={() => setDesktopSidebarCollapsed((v) => !v)}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </Button>
          ) : null}
        </div>

        {/* Branding */}
        <div className="mt-6 space-y-4">
          <AletaLogo
            title={sidebarTitle}
            subtitle={sidebarSubtitle}
            size={collapsed ? "sm" : "md"}
            className={cn(
              "[&_*]:text-white [&_p:last-child]:text-slate-300",
              collapsed && "justify-center [&>div:last-child]:hidden"
            )}
          />
          {!collapsed ? (
            <p className="text-sm leading-7 text-slate-300">{sidebarDescription}</p>
          ) : null}
        </div>

        {/* Navigation content */}
        <ScrollArea className={cn("mt-8 flex-1", collapsed ? "pr-0" : "pr-3")}>
          <div className="space-y-6">
            {/* Manajemen Surat primary nav */}
            {appContext === "manajemen_surat" && !isAdminArea && (
              <nav className="space-y-2">
                {primaryModules.map((module) => {
                  const Icon = iconMap[module.icon as keyof typeof iconMap] ?? LayoutDashboard;
                  const active = isRouteActive(pathname, searchParams, module.href);
                  return (
                    <Link
                      key={module.id}
                      href={module.href}
                      onClick={() => setMobileSidebarOpen(false)}
                      data-testid={`sidebar-module-${module.id}`}
                      title={collapsed ? module.label : undefined}
                      className={cn(
                        "flex rounded-2xl transition",
                        collapsed ? "justify-center px-0 py-3" : "items-start gap-3 px-4 py-3",
                        active
                          ? "bg-primary/90 text-primary-foreground shadow-panel"
                          : "hover:bg-white/10"
                      )}
                    >
                      <span
                        className={cn(
                          "relative rounded-xl p-2",
                          active ? "bg-white/12 text-white" : "bg-white/10 text-white"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {module.id === "surat-masuk" && inboxNotificationCount > 0 ? (
                          <span className="absolute -right-1 -top-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                            {inboxNotificationCount}
                          </span>
                        ) : null}
                      </span>
                      {!collapsed ? (
                        <span className="space-y-1">
                          <span className="flex items-center gap-2 text-sm font-semibold">
                            {module.label}
                          </span>
                          <span
                            className={cn(
                              "block text-[12px] leading-5",
                              active ? "text-primary-foreground/80" : "text-slate-300"
                            )}
                          >
                            {module.description}
                          </span>
                        </span>
                      ) : (
                        <span className="sr-only">{module.label}</span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            )}

            {/* Admin back button when inside a sub-page */}
            {isAdminArea && pathname !== "/admin" && (
              <nav className="space-y-4">
                {!collapsed ? (
                  <p className="px-4 text-[11px] uppercase tracking-[0.22em] text-slate-400">
                    Navigasi Admin
                  </p>
                ) : null}
                <Button
                  asChild
                  variant="default"
                  className={cn(
                    "rounded-2xl bg-white text-slate-950 hover:bg-white/90",
                    collapsed ? "h-12 w-full px-0" : "h-14 w-full justify-start gap-3"
                  )}
                >
                  <Link
                    href="/admin"
                    onClick={() => setMobileSidebarOpen(false)}
                    title="Kembali ke Pengaturan"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-950 text-white">
                      <ArrowLeft className="h-4 w-4" />
                    </div>
                    {!collapsed ? (
                      <span className="font-bold">Kembali ke Pengaturan</span>
                    ) : (
                      <span className="sr-only">Kembali ke Pengaturan</span>
                    )}
                  </Link>
                </Button>
              </nav>
            )}

            {/* Admin module list */}
            {adminModules.length > 0 && isAdminArea && (
              <div className="space-y-3">
                {!collapsed ? (
                  <p className="px-4 text-[11px] uppercase tracking-[0.22em] text-slate-400">
                    Pusat Manajemen Global
                  </p>
                ) : null}
                <nav className="space-y-2">
                  {adminModules.map((module) => {
                    const Icon = iconMap[module.icon as keyof typeof iconMap] ?? ShieldCheck;
                    const active = isRouteActive(pathname, searchParams, module.href);
                    return (
                      <Link
                        key={module.id}
                        href={module.href}
                        onClick={() => setMobileSidebarOpen(false)}
                        data-testid={`sidebar-module-${module.id}`}
                        title={collapsed ? module.label : undefined}
                        className={cn(
                          "flex rounded-2xl transition",
                          collapsed ? "justify-center px-0 py-3" : "items-start gap-3 px-4 py-3",
                          active
                            ? "bg-primary/90 text-primary-foreground shadow-panel"
                            : "hover:bg-white/10"
                        )}
                      >
                        <span
                          className={cn(
                            "rounded-xl p-2",
                            active ? "bg-white/12 text-white" : "bg-white/10 text-white"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        {!collapsed ? (
                          <span className="space-y-1">
                            <span className="block text-sm font-semibold">{module.label}</span>
                            <span
                              className={cn(
                                "block text-[12px] leading-5",
                                active ? "text-primary-foreground/80" : "text-slate-300"
                              )}
                            >
                              {module.description}
                            </span>
                          </span>
                        ) : (
                          <span className="sr-only">{module.label}</span>
                        )}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            )}

            {/* Context-specific static nav (aleta_bot, asisten_hakim, patch_notes, panduan) */}
            {staticItems.length > 0 && (
              <nav className="space-y-2">
                {!collapsed ? (
                  <p className="px-4 text-[11px] uppercase tracking-[0.22em] text-slate-400">
                    Navigasi
                  </p>
                ) : null}
                {staticItems.map((item) => {
                  const Icon = item.icon;
                  const active =
                    !item.external && isRouteActive(pathname, searchParams, item.href);

                  if (item.external) {
                    return (
                      <a
                        key={item.href}
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          "flex rounded-2xl transition hover:bg-white/10",
                          collapsed ? "justify-center px-0 py-3" : "items-start gap-3 px-4 py-3"
                        )}
                      >
                        <span className="rounded-xl bg-white/10 p-2 text-white">
                          <Icon className="h-4 w-4" />
                        </span>
                        {!collapsed ? (
                          <span className="space-y-1">
                            <span className="flex items-center gap-1.5 text-sm font-semibold">
                              {item.label}
                              <ExternalLink className="h-3 w-3 opacity-60" />
                            </span>
                            {item.description ? (
                              <span className="block text-[12px] leading-5 text-slate-300">
                                {item.description}
                              </span>
                            ) : null}
                          </span>
                        ) : (
                          <span className="sr-only">{item.label}</span>
                        )}
                      </a>
                    );
                  }

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileSidebarOpen(false)}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "flex rounded-2xl transition",
                        collapsed ? "justify-center px-0 py-3" : "items-start gap-3 px-4 py-3",
                        active
                          ? "bg-primary/90 text-primary-foreground shadow-panel"
                          : "hover:bg-white/10"
                      )}
                    >
                      <span
                        className={cn(
                          "rounded-xl p-2",
                          active ? "bg-white/12 text-white" : "bg-white/10 text-white"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      {!collapsed ? (
                        <span className="space-y-1">
                          <span className="flex items-center gap-2 text-sm font-semibold">
                            {item.label}
                          </span>
                          {item.description ? (
                            <span
                              className={cn(
                                "block text-[12px] leading-5",
                                active ? "text-primary-foreground/80" : "text-slate-300"
                              )}
                            >
                              {item.description}
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="sr-only">{item.label}</span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            )}
          </div>
        </ScrollArea>

        {/* User session card */}
        <div
          className={cn(
            "mt-6 rounded-[1.5rem] border border-slate-700/70 bg-slate-900/50",
            collapsed ? "p-3" : "p-4"
          )}
        >
          {!collapsed ? (
            <>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Sesi Aktif</p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="min-w-0 space-y-1 leading-tight">
                  <p className="truncate text-base font-bold text-white">{currentUser.name}</p>
                  {currentUser.nip?.trim() ? (
                    <p className="truncate text-[11px] font-normal text-slate-300">
                      {currentUser.nip}
                    </p>
                  ) : null}
                  <p className="truncate text-xs text-slate-300">{currentPositionLabel}</p>
                </div>
                <UserAvatar
                  name={currentUser.name}
                  profilePhotoUrl={currentUser.profilePhotoUrl}
                />
              </div>
            </>
          ) : (
            <div className="flex justify-center" title={currentUser.name}>
              <UserAvatar name={currentUser.name} profilePhotoUrl={currentUser.profilePhotoUrl} />
            </div>
          )}
        </div>
      </div>
    );
  };

  // ─── Outer layout ───────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(45,94,132,0.10),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent)] dark:bg-[radial-gradient(circle_at_top,rgba(74,165,228,0.12),transparent_26%),linear-gradient(180deg,rgba(15,23,42,0.28),transparent)]" />

      {/* Mobile sidebar overlay */}
      {hasSidebar ? (
        <>
          <div
            className={cn(
              "fixed inset-0 z-40 bg-slate-950/60 transition-opacity lg:hidden",
              mobileSidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
            )}
            onClick={() => setMobileSidebarOpen(false)}
          />
          <aside
            className={cn(
              "fixed inset-y-0 left-0 z-50 w-[320px] p-4 transition-transform duration-300 lg:hidden",
              mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
            )}
          >
            <div className="flex justify-end pb-3">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setMobileSidebarOpen(false)}
                aria-label="Tutup menu"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {renderSidebar({ collapsed: false, mobile: true })}
          </aside>
        </>
      ) : null}

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1600px] items-start gap-6 px-4 py-4 lg:px-6">
        {/* Desktop sidebar */}
        {hasSidebar ? (
          <aside
            className={cn(
              "sticky top-0 hidden h-screen shrink-0 transition-[width] duration-300 lg:block",
              desktopSidebarCollapsed ? "w-[104px]" : "w-[300px]"
            )}
          >
            {renderSidebar({ collapsed: desktopSidebarCollapsed })}
          </aside>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {/* Header */}
          <header className="rounded-[2rem] border border-border/80 bg-card/90 p-4 shadow-panel backdrop-blur">
            <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
              <div className="flex items-start gap-3">
                {hasSidebar ? (
                  <Button
                    variant="outline"
                    size="icon"
                    className="mt-1 lg:hidden"
                    onClick={() => setMobileSidebarOpen(true)}
                    aria-label="Buka navigasi"
                  >
                    <Menu className="h-4 w-4" />
                  </Button>
                ) : null}

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    {breadcrumbs.map((crumb, index) => (
                      <span key={index} className="flex items-center gap-2">
                        <span>{crumb.label}</span>
                        {index < breadcrumbs.length - 1 ? <span>/</span> : null}
                      </span>
                    ))}
                  </div>
                  <div>
                    <h2 className="font-serif text-2xl text-foreground">{pageTitle}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <Badge variant="muted">{currentUser.name}</Badge>
                      <Badge variant="default">{currentRoleBadge}</Badge>
                      <span>Fokus: {pageFocus}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-center xl:justify-end">
                {appContext === "manajemen_surat" && !isAdminArea ? (
                  <HeaderSearchForm />
                ) : null}

                <div className="flex items-center gap-3 self-end xl:self-auto">
                  <ThemeToggle />

                  {isAdminTier ? (
                    <Button variant="outline" size="icon" aria-label="Pengaturan" asChild>
                      <Link href="/admin">
                        <Settings className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : null}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Notifikasi"
                        className="relative"
                        onClick={() => markPendingInboxSeen()}
                      >
                        {globalTaskCount > 0 ? (
                          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                            {globalTaskCount}
                          </span>
                        ) : null}
                        <Bell className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[300px]">
                      <DropdownMenuLabel>Pusat Tugas & Notifikasi</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {pendingInbox.length === 0 ? (
                        <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                          Tidak ada tugas mendesak saat ini.
                        </div>
                      ) : (
                        pendingInbox.slice(0, 4).map((item) => (
                          <DropdownMenuItem
                            key={item.id}
                            onSelect={() => {
                              markPendingInboxSeen([item.id]);
                              router.push(`/disposisi/${item.id}`);
                            }}
                            className="cursor-pointer"
                          >
                            <div className="space-y-1">
                              <p className="font-medium line-clamp-1">{item.instruksi}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatDateTime(item.createdAt)}
                              </p>
                            </div>
                          </DropdownMenuItem>
                        ))
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="justify-center text-xs font-semibold text-primary focus:bg-primary/5 active:bg-primary/10"
                        onSelect={() => router.push("/tugas")}
                      >
                        Buka Pusat Tugas Selengkapnya
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        data-testid="user-menu"
                        variant="outline"
                        className="justify-between gap-3"
                      >
                        <UserAvatar
                          name={currentUser.name}
                          profilePhotoUrl={currentUser.profilePhotoUrl}
                          className="h-8 w-8 rounded-xl"
                          textClassName="text-xs"
                        />
                        <span className="hidden text-sm font-semibold text-foreground sm:inline">
                          Profil
                        </span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Profil Login</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>
                        <div className="space-y-1 leading-tight">
                          <p className="text-sm font-bold">{currentUser.name}</p>
                          {currentUser.nip?.trim() ? (
                            <p className="text-[11px] font-normal text-muted-foreground">
                              {currentUser.nip}
                            </p>
                          ) : null}
                          <p className="font-medium">{currentUser.username}</p>
                          <p className="text-xs text-muted-foreground">{currentPositionLabel}</p>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => router.push("/account")}>
                        Edit Profil / Akun
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        data-testid="logout-button"
                        onSelect={() => {
                          signOut();
                          router.push("/login");
                        }}
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Keluar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </header>

          <main className="pb-2">{children}</main>
          <PortalFooter />
        </div>
      </div>
    </div>
  );
}

function HeaderSearchForm() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  return (
    <form
      className="flex w-full items-center gap-2 xl:w-auto"
      onSubmit={(event) => {
        event.preventDefault();
        router.push(`/search?q=${encodeURIComponent(query)}`);
      }}
    >
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Cari surat, perihal, nomor, atau pengirim..."
        className="w-full xl:min-w-[320px]"
      />
      <Button type="submit" variant="outline" size="icon" aria-label="Cari cepat">
        <Search className="h-4 w-4" />
      </Button>
    </form>
  );
}
