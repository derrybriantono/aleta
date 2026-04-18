"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  Bell,
  BookOpenText,
  BriefcaseBusiness,
  ChartColumn,
  GitBranchPlus,
  Inbox,
  LayoutDashboard,
  Landmark,
  LibraryBig,
  LoaderCircle,
  LogOut,
  Menu,
  MessageCircleMore,
  Search,
  Send,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  Sparkles,
  UserCog,
  UsersRound,
  Wallet,
  X,
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
import { formatDateTime } from "@/lib/format";
import type { ModuleId } from "@/lib/types";
import { findModuleByRoute, getUserPositionLabel, getUserRoleBadge } from "@/lib/permissions";
import { cn } from "@/lib/utils";

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
};

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

function prettifySegment(segment: string) {
  return segment.replace(/-/g, " ");
}

function isAdminRoute(pathname: string) {
  return pathname.startsWith("/admin");
}

function isSuratWorkspaceRoute(pathname: string) {
  return (
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
    pathname.startsWith("/admin") ||
    pathname.startsWith("/account")
  );
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

  if (type) {
    return searchParams.get("type") === type;
  }

  if (metric) {
    return searchParams.get("metric") === metric;
  }

  return true;
}

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
    markPendingInboxSeen,
    pendingInbox,
    signOut,
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
  const isSuratWorkspace = isSuratWorkspaceRoute(pathname);
  const isAdminArea = isAdminRoute(pathname);
  const suratType = searchParams.get("type");
  const activeModule = isSuratWorkspace ? findModuleByRoute(pathname) : null;
  const primaryModules = accessibleModules
    .filter((module) => primarySidebarIds.has(module.id))
    .sort(
      (left, right) =>
        (primarySidebarOrderMap.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (primarySidebarOrderMap.get(right.id) ?? Number.MAX_SAFE_INTEGER)
    );
  const adminModules = accessibleModules.filter((module) => adminSidebarIds.has(module.id));

  const pageTitle =
    pathname === "/portal"
      ? "ALETA"
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

  const renderSidebar = ({ collapsed, mobile = false }: { collapsed: boolean; mobile?: boolean }) => (
    <div
      className={cn(
        "flex h-screen flex-col rounded-[2rem] border border-slate-800/80 bg-slate-950/95 text-slate-100 shadow-panel backdrop-blur transition-all duration-300",
        collapsed ? "px-3 py-5" : "p-5"
      )}
    >
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
          <Link href="/portal" onClick={() => setMobileSidebarOpen(false)} title="Kembali ke Portal ALETA">
            <ArrowLeft className="h-4 w-4" />
            {collapsed ? <span className="sr-only">Kembali ke Portal ALETA</span> : "Kembali ke Portal ALETA"}
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
            onClick={() => setDesktopSidebarCollapsed((currentValue) => !currentValue)}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        ) : null}
      </div>

      <div className="mt-6 space-y-4">
        <AletaLogo
          title={isAdminArea ? "Portal Pengaturan" : "Manajemen Surat"}
          subtitle={collapsed ? undefined : isAdminArea ? "Pusat Kontrol Global ALETA" : "Sub-modul aktif di dalam ALETA"}
          size={collapsed ? "sm" : "md"}
          className={cn(
            "[&_*]:text-white [&_p:last-child]:text-slate-300",
            collapsed && "justify-center [&>div:last-child]:hidden"
          )}
        />
        {!collapsed ? (
          <p className="text-sm leading-7 text-slate-300">
            {isAdminArea
              ? "Kelola identitas instansi, akun pengguna, dan visibilitas platform secara terpusat."
              : "Inbox, surat, arsip, statistik, dan disposisi dipusatkan dalam satu workspace."}
          </p>
        ) : null}
      </div>

      <ScrollArea className={cn("mt-8 flex-1", collapsed ? "pr-0" : "pr-3")}>
        <div className="space-y-6">
          {!isAdminArea && (
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
                      active ? "bg-primary/90 text-primary-foreground shadow-panel" : "hover:bg-white/10"
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
                        <span className="flex items-center gap-2 text-sm font-semibold">{module.label}</span>
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

          {isAdminArea && pathname !== "/admin" && (
            <nav className="space-y-4">
              {!collapsed ? <p className="px-4 text-[11px] uppercase tracking-[0.22em] text-slate-400">Navigasi Admin</p> : null}
              <Button
                asChild
                variant="default"
                className={cn(
                  "rounded-2xl bg-white text-slate-950 hover:bg-white/90",
                  collapsed ? "h-12 w-full px-0" : "h-14 w-full justify-start gap-3"
                )}
              >
                <Link href="/admin" onClick={() => setMobileSidebarOpen(false)} title="Kembali ke Pengaturan">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-950 text-white">
                    <ArrowLeft className="h-4 w-4" />
                  </div>
                  {!collapsed ? <span className="font-bold">Kembali ke Pengaturan</span> : <span className="sr-only">Kembali ke Pengaturan</span>}
                </Link>
              </Button>
            </nav>
          )}

          {adminModules.length > 0 && (
            <div className="space-y-3">
              {!collapsed ? (
                <p className="px-4 text-[11px] uppercase tracking-[0.22em] text-slate-400">
                  {isAdminArea ? "Pusat Manajemen Global" : "Admin Internal"}
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
                        active ? "bg-primary/90 text-primary-foreground shadow-panel" : "hover:bg-white/10"
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
        </div>
      </ScrollArea>

      <div className={cn("mt-6 rounded-[1.5rem] border border-white/10 bg-white/5", collapsed ? "p-3" : "p-4")}>
        {!collapsed ? (
          <>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Sesi Aktif</p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="min-w-0 space-y-1 leading-tight">
                <p className="truncate text-base font-bold text-white">{currentUser.name}</p>
                {currentUser.nip?.trim() ? (
                  <p className="truncate text-[11px] font-normal text-slate-300">{currentUser.nip}</p>
                ) : null}
                <p className="truncate text-xs text-slate-300">{currentPositionLabel}</p>
              </div>
              <UserAvatar name={currentUser.name} profilePhotoUrl={currentUser.profilePhotoUrl} />
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(45,94,132,0.10),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent)] dark:bg-[radial-gradient(circle_at_top,rgba(74,165,228,0.12),transparent_26%),linear-gradient(180deg,rgba(15,23,42,0.28),transparent)]" />

      {isSuratWorkspace ? (
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
              <Button variant="outline" size="icon" onClick={() => setMobileSidebarOpen(false)} aria-label="Tutup menu">
                <X className="h-4 w-4" />
              </Button>
            </div>
            {renderSidebar({ collapsed: false, mobile: true })}
          </aside>
        </>
      ) : null}

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1600px] items-start gap-6 px-4 py-4 lg:px-6">
        {isSuratWorkspace ? (
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
          <header className="rounded-[2rem] border border-border/80 bg-card/90 p-4 shadow-panel backdrop-blur">
            <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
              <div className="flex items-start gap-3">
                {isSuratWorkspace ? (
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
                      <Badge variant="outline">{currentUser.name}</Badge>
                      <Badge variant="outline">{currentRoleBadge}</Badge>
                      <span>Fokus: {pageFocus}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-center xl:justify-end">
                {isSuratWorkspace && !isAdminArea ? <HeaderSearchForm /> : null}

                <div className="flex items-center gap-3 self-end xl:self-auto">
                  <ThemeToggle />

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
                                <p className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</p>
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
                      <Button data-testid="user-menu" variant="outline" className="justify-between gap-3">
                        <UserAvatar
                          name={currentUser.name}
                          profilePhotoUrl={currentUser.profilePhotoUrl}
                          className="h-8 w-8 rounded-xl"
                          textClassName="text-xs"
                        />
                        <span className="hidden text-sm font-semibold text-foreground sm:inline">Profil</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Profil Login</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>
                        <div className="space-y-1 leading-tight">
                          <p className="text-sm font-bold">{currentUser.name}</p>
                          {currentUser.nip?.trim() ? (
                            <p className="text-[11px] font-normal text-muted-foreground">{currentUser.nip}</p>
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
