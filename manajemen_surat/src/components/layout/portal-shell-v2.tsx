"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  Bell,
  BookOpenText,
  Bot,
  BriefcaseBusiness,
  CalendarDays,
  ChartColumn,
  ChevronDown,
  ClipboardCheck,
  Database,
  DatabaseBackup,
  ExternalLink,
  FileUp,
  GitBranchPlus,
  Globe,
  History,
  Inbox,
  LayoutDashboard,
  Landmark,
  LibraryBig,
  LoaderCircle,
  LogOut,
  Menu,
  MessageCircleMore,
  PackageCheck,
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
import { useCallback, useEffect, useState } from "react";

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
import { getAssistantJudgeOpenHref, getVisibleAssistantJudgeLinks, isAssistantJudgeEmbeddedEnabled } from "@/lib/assistant-judge";
import { apiPath } from "@/lib/base-path";
import { formatDateTime } from "@/lib/format";
import type { TaskItem } from "@/lib/task-sources";
import type { ModuleId } from "@/lib/types";
import {
  findModuleByRoute,
  getEffectiveRoleId,
  getUserPositionLabel,
  getUserRoleBadge,
} from "@/lib/permissions";
import {
  getJudiciaLegalFormSidebarItems,
  resolveJudiciaLegalFormAccess,
} from "@/lib/judicia-legal-form-types";
import {
  getAletaSippSidebarItems,
  resolveAletaSippAccess,
} from "@/lib/aleta-sipp-types";
import { cn } from "@/lib/utils";

// ─── Icon map ─────────────────────────────────────────────────────────────────

const iconMap = {
  "layout-dashboard": LayoutDashboard,
  archive: Archive,
  bell: Bell,
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
  "package-check": PackageCheck,
  "book-open-text": BookOpenText,
  "library-big": LibraryBig,
  "user-cog": UserCog,
  landmark: Landmark,
  scale: Scale,
  sparkles: Sparkles,
  bot: Bot,
  database: Database,
  "database-backup": DatabaseBackup,
  "calendar-days": CalendarDays,
  settings: Settings,
  globe: Globe,
};

// ─── App context ──────────────────────────────────────────────────────────────

type AppContext =
  | "portal"
  | "account"
  | "manajemen_surat"
  | "aleta_bot"
  | "aleta_sipp"
  | "judicia_legal_form"
  | "asisten_hakim"
  | "e_kepegawaian"
  | "admin"
  | "patch_notes"
  | "panduan"
  | "feedback"
  | "default";

function getAppContext(pathname: string): AppContext {
  if (pathname === "/portal" || pathname.startsWith("/apps/")) return "portal";
  if (pathname.startsWith("/account")) return "account";
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/aleta-bot")) return "aleta_bot";
  if (pathname.startsWith("/aleta-sipp")) return "aleta_sipp";
  if (pathname.startsWith("/judicia/legal-form")) return "judicia_legal_form";
  if (pathname.startsWith("/asisten-hakim")) return "asisten_hakim";
  if (pathname.startsWith("/e-kepegawaian")) return "e_kepegawaian";
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
    pathname.startsWith("/search")
  )
    return "manajemen_surat";
  return "default";
}

function hasSidebarForContext(ctx: AppContext): boolean {
  return (
    ctx === "account" ||
    ctx === "manajemen_surat" ||
    ctx === "admin" ||
    ctx === "aleta_bot" ||
    ctx === "aleta_sipp" ||
    ctx === "judicia_legal_form" ||
    ctx === "asisten_hakim" ||
    ctx === "e_kepegawaian" ||
    ctx === "patch_notes" ||
    ctx === "panduan" ||
    ctx === "feedback"
  );
}

// ─── Sidebar module sets ──────────────────────────────────────────────────────

const primarySidebarIds: ReadonlySet<ModuleId> = new Set([
  "dashboard",
  "notifikasi",
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
  "panel-settings",
  "public-access",
  "ai-settings",
  "assistant-judge-settings",
  "whatsapp-settings",
  "system-updates",
  "backup-system",
  "database-viewer",
  "aleta-bot",
  "aleta-sipp-settings",
  "judicia-legal-form-settings",
  "hr-settings",
  "feedback",
]);
const adminSidebarGroups = [
  {
    id: "office",
    label: "Manajemen Kantor",
    moduleIds: ["mapping-user-jabatan", "identity", "panel-settings", "hr-settings", "public-access", "feedback"],
  },
  {
    id: "governance",
    label: "Akses & Pemeriksaan",
    moduleIds: ["visibility-role", "audit", "database-viewer"],
  },
  {
    id: "services",
    label: "Layanan & Integrasi",
    moduleIds: ["whatsapp-settings", "ai-settings", "assistant-judge-settings", "aleta-bot"],
  },
  {
    id: "judicial",
    label: "Peradilan",
    moduleIds: ["aleta-sipp-settings", "judicia-legal-form-settings"],
  },
  {
    id: "system",
    label: "Sistem",
    moduleIds: ["system-updates", "backup-system"],
  },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  moduleIds: readonly ModuleId[];
}>;
const compactAdminSidebarDescriptions: Partial<Record<ModuleId, string>> = {
  "mapping-user-jabatan": "Akun, WhatsApp, dan jabatan.",
  identity: "Nama, logo, alamat, dan kanal resmi.",
  "panel-settings": "Tampilan panel dan portal.",
  "hr-settings": "Config cuti, dokumen, dan workflow.",
  "public-access": "Domain publik dan akses internet.",
  feedback: "Kendala dan saran pengguna.",
  "visibility-role": "Akses menu tiap peran.",
  audit: "Jejak aktivitas penting.",
  "database-viewer": "Lihat dan edit PostgreSQL.",
  "whatsapp-settings": "Koneksi dan QR WhatsApp.",
  "ai-settings": "API Key dan model AI.",
  "assistant-judge-settings": "Akses Asisten Hakim.",
  "aleta-bot": "Bot, pesan, log, dan laporan.",
  "aleta-sipp-settings": "Kamus SIPP, registry, penilaian, dan audit.",
  "judicia-legal-form-settings": "Legal Form, SIPP, AI, KB, dan audit.",
  "system-updates": "Versi dan paket update.",
  "backup-system": "Backup database dan aplikasi.",
};
const DESKTOP_SIDEBAR_STORAGE_KEY = "aleta:portal-sidebar-collapsed";
const primarySidebarOrder = [
  "dashboard",
  "notifikasi",
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
    if (targetPath === "/aleta-sipp") {
      return pathname === "/aleta-sipp" && !searchParams.has("section");
    }
    if (targetPath === "/judicia/legal-form") {
      return pathname === "/judicia/legal-form" && !searchParams.has("section");
    }
    return pathname === targetPath || pathname.startsWith(`${targetPath}/`);
  }

  if (pathname !== targetPath) return false;

  const targetParams = new URLSearchParams(queryString);
  const type = targetParams.get("type");
  const metric = targetParams.get("metric");

  if (type) return searchParams.get("type") === type;
  if (metric) return searchParams.get("metric") === metric;
  const section = targetParams.get("section");
  if (section) return searchParams.get("section") === section;
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
  if (ctx === "account") return "Aplikasi ALETA";
  if (ctx === "aleta_bot") return "ALETA Bot";
  if (ctx === "aleta_sipp") return "ALETA x SIPP";
  if (ctx === "judicia_legal_form") return "ALETA Judicia";
  if (ctx === "asisten_hakim") return "Asisten Hakim";
  if (ctx === "e_kepegawaian") return "E-Kepegawaian";
  if (ctx === "patch_notes") return "Informasi";
  if (ctx === "panduan") return "Panduan";
  if (ctx === "feedback") return "Pusat Masukan";
  return "Manajemen Surat";
}

function getSidebarSubtitle(ctx: AppContext, isAdminArea: boolean, collapsed: boolean): string | undefined {
  if (collapsed) return undefined;
  if (isAdminArea) return "Pengaturan ALETA";
  if (ctx === "account") return "Aplikasi tersedia";
  if (ctx === "aleta_bot") return "Riwayat pesan WhatsApp";
  if (ctx === "aleta_sipp") return "Kamus dan monitoring SIPP";
  if (ctx === "judicia_legal_form") return "Legal Form perkara";
  if (ctx === "asisten_hakim") return "Asisten Hakim";
  if (ctx === "e_kepegawaian") return "Layanan kepegawaian";
  if (ctx === "patch_notes" || ctx === "panduan") return "Info dan panduan ALETA";
  if (ctx === "feedback") return "Kendala dan saran";
  return "Menu kerja surat";
}

function getSidebarDescription(ctx: AppContext, isAdminArea: boolean): string {
  if (isAdminArea)
    return "Kelola akun, identitas instansi, WhatsApp, dan akses menu.";
  if (ctx === "account")
    return "Pilih aplikasi yang bisa Anda buka dari akun ini.";
  if (ctx === "aleta_bot")
    return "Lihat kondisi WhatsApp Bot dan pesan yang dikirim.";
  if (ctx === "aleta_sipp")
    return "Kamus database, query registry, variabel, penilaian, dan jadwal sidang.";
  if (ctx === "judicia_legal_form")
    return "Dokumen perkara, template, data SIPP, validasi, dan AI assistant JLF.";
  if (ctx === "asisten_hakim")
    return "Buka asisten yang boleh digunakan sesuai peran Anda.";
  if (ctx === "e_kepegawaian")
    return "Cuti, dokumen, approval, dan monitoring kepegawaian.";
  if (ctx === "patch_notes") return "Lihat ringkasan pembaruan ALETA.";
  if (ctx === "panduan") return "Panduan penggunaan ALETA sesuai pekerjaan Anda.";
  if (ctx === "feedback")
    return "Kirim kendala, saran fitur, atau usulan aplikasi baru.";
  return "Surat, disposisi, arsip, dan pencarian ada di sini.";
}

// ─── Main shell component ─────────────────────────────────────────────────────

export function PortalShellV2({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {
    accessiblePortalApps,
    accessibleModules,
    currentUser,
    inboxNotificationCount,
    globalTaskCount,
    isHydrated,
    isAuthPending,
    isSyncing,
    currentUserId,
    markTaskItemsSeen,
    positions,
    signOut,
    assistantJudgeConfig,
    taskSources,
    taskSummary,
  } = usePortal();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  // Mode default: sidebar diciutkan. Preferensi pengguna (localStorage) tetap menang.
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [hasSystemUpdate, setHasSystemUpdate] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [openAdminSidebarGroups, setOpenAdminSidebarGroups] = useState<Record<string, boolean>>({
    office: true,
    governance: true,
    services: true,
    judicial: true,
    system: true,
  });

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
    if (!isMounted || !isHydrated || isAuthPending || isSyncing || currentUser || currentUserId) return;
    window.location.replace(apiPath("/login"));
  }, [currentUser, currentUserId, isAuthPending, isHydrated, isMounted, isSyncing]);

  const handleLogout = useCallback(async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    window.dispatchEvent(new Event("aleta:hide-loading"));

    try {
      await signOut();
    } finally {
      window.location.assign(apiPath("/login"));
    }
  }, [isSigningOut, signOut]);

  useEffect(() => {
    let cancelled = false;
    const roleId = getEffectiveRoleId(currentUser);
    const canCheckUpdates = roleId === "super-admin" || roleId === "admin";

    if (!isMounted || !canCheckUpdates) {
      const resetTimer = window.setTimeout(() => setHasSystemUpdate(false), 0);
      return () => {
        cancelled = true;
        window.clearTimeout(resetTimer);
      };
    }

    const loadUpdateNotification = async () => {
      try {
        const response = await fetch(apiPath("/api/system/update-status"), {
          credentials: "include",
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; data?: { updateAvailable?: boolean } }
          | null;

        if (!cancelled) {
          setHasSystemUpdate(Boolean(response.ok && payload?.ok && payload.data?.updateAvailable));
        }
      } catch {
        if (!cancelled) {
          setHasSystemUpdate(false);
        }
      }
    };

    void loadUpdateNotification();

    return () => {
      cancelled = true;
    };
  }, [currentUser, isMounted]);

  if (!isMounted || !isHydrated || isAuthPending || isSyncing || !currentUser) {
    const redirectingToLogin = isMounted && isHydrated && !isAuthPending && !isSyncing && !currentUser && !currentUserId;
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        {isMounted ? (
          <div className="flex items-center gap-3 rounded-full border border-border bg-card px-5 py-3 text-sm text-muted-foreground shadow-panel">
            <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
            {redirectingToLogin ? "Mengalihkan ke login..." : "Menyiapkan portal..."}
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
  const currentPositionLabel = getUserPositionLabel(currentUser, positions);
  const effectiveRoleId = getEffectiveRoleId(currentUser);
  const isAdminTier = effectiveRoleId === "super-admin" || effectiveRoleId === "admin";
  const isSuperAdmin = effectiveRoleId === "super-admin";
  const bellTasks = taskSources
    .flatMap((source) => source.tasks)
    .sort((left, right) => {
      if ((left.priority === "urgent") !== (right.priority === "urgent")) {
        return left.priority === "urgent" ? -1 : 1;
      }
      if (left.seen !== right.seen) return left.seen ? 1 : -1;
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
  const visibleBellTasks = bellTasks.slice(0, 5);
  const unreadBellTasks = bellTasks.filter((task) => !task.seen);
  const hasBellItems = visibleBellTasks.length > 0;
  const taskBreakdownTitle = `${taskSummary.total} tugas: ${taskSummary.unread} belum dilihat, ${taskSummary.urgent} mendesak`;

  const markVisibleTasksSeen = (items: TaskItem[]) => {
    if (items.length === 0) return;
    if (items.length > 10 && !window.confirm(`Tandai ${items.length} tugas sebagai sudah dilihat?`)) return;
    markTaskItemsSeen(items.map((item) => ({ entityType: item.entityType, entityId: item.entityId })));
  };

  const appContext = getAppContext(pathname);
  const isAdminArea = isAdminRoute(pathname);
  const hasSidebar = hasSidebarForContext(appContext);
  const suratType = searchParams.get("type");
  const showHistoryBackButton = pathname !== "/portal";

  const handleHistoryBack = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/portal");
  };

  const activeModule =
    appContext === "manajemen_surat" || appContext === "judicia_legal_form" || appContext === "aleta_sipp" || isAdminArea
      ? findModuleByRoute(pathname)
      : null;

  const primaryModules = accessibleModules
    .filter((module) => primarySidebarIds.has(module.id))
    .sort(
      (left, right) =>
        (primarySidebarOrderMap.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (primarySidebarOrderMap.get(right.id) ?? Number.MAX_SAFE_INTEGER)
  );
  const adminModules = accessibleModules.filter((module) => adminSidebarIds.has(module.id));
  const sidebarQuery = sidebarSearch.trim().toLocaleLowerCase("id-ID");

  // ─── Page title / focus / breadcrumb ───────────────────────────────────────

  const pageTitle =
    pathname === "/portal"
      ? "ALETA"
      : pathname === "/account"
      ? "Profil Akun"
      : pathname === "/aleta-bot"
      ? "ALETA Bot"
      : pathname.startsWith("/aleta-sipp")
      ? "ALETA x SIPP"
      : pathname.startsWith("/judicia/legal-form")
      ? "ALETA Judicia (Legal Form)"
      : pathname === "/patch-notes"
      ? "Catatan Pembaruan"
      : pathname === "/panduan"
      ? "Panduan Penggunaan"
      : pathname === "/masukan"
      ? "Pusat Masukan ALETA"
      : pathname === "/asisten-hakim"
      ? "Asisten Hakim"
      : pathname === "/e-kepegawaian"
      ? "E-Kepegawaian"
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
      ? "Pilih menu kerja dan cek tugas penting."
      : pathname === "/account"
      ? "Edit profil login dan buka aplikasi yang tersedia."
      : pathname === "/aleta-bot"
      ? "Kondisi WhatsApp Bot dan riwayat pesan."
      : pathname.startsWith("/aleta-sipp")
      ? "Kamus database SIPP, query registry, variabel ABT/SIPP, penilaian, dan PDF jadwal sidang."
      : pathname.startsWith("/judicia/legal-form")
      ? "Legal Form, dokumen perkara, template, variabel, dan data SIPP read-only."
      : pathname === "/patch-notes"
      ? "Catatan pembaruan ALETA."
      : pathname === "/panduan"
      ? "Panduan penggunaan ALETA sesuai pekerjaan Anda."
      : pathname === "/masukan"
      ? "Kirim kendala, saran fitur, atau usulan."
      : pathname === "/asisten-hakim"
      ? "Buka asisten yang tersedia untuk peran Anda."
      : pathname === "/e-kepegawaian"
      ? "Layanan kepegawaian sesuai role dan kewenangan Anda."
      : pathname === "/admin/feedback"
      ? "Tinjau, filter, dan tindak lanjuti masukan pengguna ALETA."
      : pathname === "/admin/asisten-hakim"
      ? "Atur tautan Asisten Hakim dan akses pengguna."
      : pathname === "/manajemen-surat"
      ? "Ringkasan surat dan tugas penting."
      : pathname === "/surat"
      ? suratType === "masuk"
        ? "Catat dan tindak lanjuti surat masuk."
        : suratType === "keluar"
        ? "Catat dan pantau surat keluar."
        : "Daftar surat yang bisa Anda akses."
      : pathname.startsWith("/apps/")
      ? "Contoh menu aplikasi ALETA."
      : isAdminArea
      ? isSuperAdmin
        ? "Pengaturan teknis, akses, dan layanan ALETA."
        : "Pengaturan akun, identitas, dan layanan ALETA."
      : "Area kerja yang sedang dibuka.";

  // ─── Sidebar renderer ───────────────────────────────────────────────────────

  const renderSidebar = ({ collapsed, mobile = false }: { collapsed: boolean; mobile?: boolean }) => {
    const sidebarTitle = getSidebarTitle(appContext, isAdminArea);
    const sidebarSubtitle = getSidebarSubtitle(appContext, isAdminArea, collapsed);
    const sidebarDescription = getSidebarDescription(appContext, isAdminArea);

    // Static nav items for non-manajemen_surat / non-admin contexts
    const staticNavForContext = (): StaticNavItem[] => {
      if (appContext === "account") {
        return accessiblePortalApps.map((app) => ({
          label: app.label,
          description: app.description,
          href: app.href,
          icon: iconMap[app.icon as keyof typeof iconMap] ?? LayoutDashboard,
        }));
      }

      if (appContext === "aleta_bot") {
        const items: StaticNavItem[] = [
          {
            label: "Dashboard ALETA Bot",
            description: "Kondisi bot dan riwayat pesan",
            href: "/aleta-bot",
            icon: Bot,
          },
        ];
        if (isSuperAdmin) {
          items.push({
            label: "Pengaturan Admin ALETA Bot",
            description: "Pengaturan teknis bot - khusus Super Admin",
            href: "/admin/aleta-bot",
            icon: Settings,
          });
        }
        return items;
      }

      if (appContext === "aleta_sipp") {
        const aletaSippAccess = resolveAletaSippAccess(currentUser, {
          effectiveRoleId,
          positionLabel: currentPositionLabel,
        });

        return getAletaSippSidebarItems(aletaSippAccess).map((item) => ({
          label: item.label,
          description: item.description,
          href: item.href,
          icon: iconMap[item.iconKey as keyof typeof iconMap] ?? Database,
        }));
      }

      if (appContext === "judicia_legal_form") {
        const jlfAccess = resolveJudiciaLegalFormAccess(currentUser, {
          effectiveRoleId,
          positionLabel: currentPositionLabel,
        });

        return getJudiciaLegalFormSidebarItems(jlfAccess).map((item) => ({
          label: item.label,
          description: item.description,
          href: item.href,
          icon: iconMap[item.iconKey as keyof typeof iconMap] ?? LayoutDashboard,
        }));
      }

      if (appContext === "asisten_hakim") {
        const items: StaticNavItem[] = [
          {
            label: "Beranda Asisten Hakim",
            description: "Pilih Asisten Hakim",
            href: "/asisten-hakim",
            icon: Scale,
          },
        ];
        if (assistantJudgeConfig.enabled) {
          for (const link of getVisibleAssistantJudgeLinks(assistantJudgeConfig, effectiveRoleId, currentUser.id)) {
            const embeddedEnabled = isAssistantJudgeEmbeddedEnabled(link);
            items.push({
              label: link.label,
              description: embeddedEnabled ? "Buka dalam ALETA" : "Buka website AI",
              href: getAssistantJudgeOpenHref(link),
              external: !embeddedEnabled,
              icon: link.iconKey === "scale" ? Scale : Sparkles,
            });
          }
        }
        if (isSuperAdmin) {
          items.push({
            label: "Pengaturan Asisten Hakim",
            description: "Atur menu Asisten Hakim",
            href: "/admin/asisten-hakim",
            icon: Settings,
          });
        }
        items.push({
          label: "Panduan Penggunaan",
          description: "Panduan ALETA",
          href: "/panduan",
          icon: BookOpenText,
        });
        return items;
      }

      if (appContext === "e_kepegawaian") {
        const positionLabel = currentPositionLabel.toLocaleLowerCase("id-ID");
        const isHrPosition =
          positionLabel.includes("kepegawaian") ||
          positionLabel.includes("ortala") ||
          positionLabel.includes("organisasi");
        const isApproverTier =
          isAdminTier ||
          isHrPosition ||
          ["ketua", "wakil-ketua", "panitera", "sekretaris", "kasubag", "pejabat-struktural"].includes(effectiveRoleId ?? "");

        if (isAdminTier) {
          return [
            {
              label: "Dashboard Admin",
              description: "Monitoring global E-Kepegawaian",
              href: "/e-kepegawaian?section=dashboard",
              icon: LayoutDashboard,
            },
            {
              label: "Approval & Validasi",
              description: "Cuti, izin, dan verifikasi dokumen",
              href: "/e-kepegawaian?section=approval",
              icon: ClipboardCheck,
            },
            {
              label: "Monitoring Pegawai",
              description: "Data pegawai dan relasi approval",
              href: "/e-kepegawaian?section=pegawai",
              icon: UsersRound,
            },
            {
              label: "Dokumen HR",
              description: "Lampiran dan arsip kepegawaian",
              href: "/e-kepegawaian?section=dokumen",
              icon: Archive,
            },
            {
              label: "Rekap & Export",
              description: "Excel/PDF dan saldo cuti",
              href: "/e-kepegawaian?section=rekap",
              icon: ChartColumn,
            },
            {
              label: "Pengaturan Admin",
              description: "Config cuti, workflow, upload, dan kalender",
              href: "/admin/e-kepegawaian",
              icon: Settings,
            },
          ];
        }

        if (isApproverTier) {
          return [
            {
              label: "Dashboard Approval",
              description: "Permintaan yang perlu ditindaklanjuti",
              href: "/e-kepegawaian?section=dashboard",
              icon: LayoutDashboard,
            },
            {
              label: "Permintaan Cuti",
              description: "Setujui, tolak, atau minta revisi",
              href: "/e-kepegawaian?section=approval",
              icon: ClipboardCheck,
            },
            {
              label: "Verifikasi Dokumen",
              description: "PCK, SKP, WFA, dan lampiran",
              href: "/e-kepegawaian?section=pck",
              icon: FileUp,
            },
            {
              label: "Monitoring Pegawai",
              description: "Pegawai dan proses kepegawaian",
              href: "/e-kepegawaian?section=pegawai",
              icon: UsersRound,
            },
            {
              label: "Riwayat Persetujuan",
              description: "Jejak approval dan catatan pejabat",
              href: "/e-kepegawaian?section=rekap",
              icon: History,
            },
          ];
        }

        return [
          {
            label: "Dashboard Saya",
            description: "Sisa cuti dan status aktif",
            href: "/e-kepegawaian?section=dashboard",
            icon: LayoutDashboard,
          },
          {
            label: "Pengajuan Cuti",
            description: "Form cuti dan riwayat cuti",
            href: "/e-kepegawaian?section=cuti",
            icon: CalendarDays,
          },
          {
            label: "Upload PCK",
            description: "Setor dokumen PCK",
            href: "/e-kepegawaian?section=pck",
            icon: FileUp,
          },
          {
            label: "Upload SKP",
            description: "Setor dokumen SKP",
            href: "/e-kepegawaian?section=skp",
            icon: FileUp,
          },
          {
            label: "Upload WFA",
            description: "Setor laporan WFA",
            href: "/e-kepegawaian?section=wfa",
            icon: FileUp,
          },
          {
            label: "Izin Kehadiran",
            description: "Lambat datang atau cepat pulang",
            href: "/e-kepegawaian?section=izin",
            icon: Send,
          },
          {
            label: "Dokumen Saya",
            description: "Lampiran dan arsip pribadi",
            href: "/e-kepegawaian?section=dokumen",
            icon: Archive,
          },
        ];
      }

      if (appContext === "patch_notes") {
        return [
          {
            label: "Catatan Pembaruan",
            description: "Ringkasan pembaruan ALETA",
            href: "/patch-notes",
            icon: GitBranchPlus,
          },
          {
            label: "Panduan Penggunaan",
            description: "Panduan ALETA",
            href: "/panduan",
            icon: BookOpenText,
          },
          {
            label: "Beri Masukan",
            description: "Kirim kendala atau saran",
            href: "/masukan",
            icon: MessageCircleMore,
          },
        ];
      }

      if (appContext === "panduan") {
        return [
          {
            label: "Panduan Penggunaan",
            description: "Panduan ALETA",
            href: "/panduan",
            icon: BookOpenText,
          },
          {
            label: "Catatan Pembaruan",
            description: "Ringkasan pembaruan ALETA",
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
            description: "Kendala, saran fitur, dan usulan aplikasi",
            href: "/masukan",
            icon: MessageCircleMore,
          },
          {
            label: "Panduan Penggunaan",
            description: "Panduan ALETA",
            href: "/panduan",
            icon: BookOpenText,
          },
          {
            label: "Catatan Pembaruan",
            description: "Ringkasan pembaruan ALETA",
            href: "/patch-notes",
            icon: GitBranchPlus,
          },
        ];
      }

      return [];
    };

    const staticItems = staticNavForContext();
    const activeSidebarQuery = collapsed ? "" : sidebarQuery;
    const hasSidebarSearch = activeSidebarQuery.length > 0;
    const matchesSidebarSearch = (label: string, description?: string) =>
      !hasSidebarSearch ||
      `${label} ${description ?? ""}`.toLocaleLowerCase("id-ID").includes(activeSidebarQuery);
    const visiblePrimaryModules = primaryModules.filter((module) =>
      matchesSidebarSearch(module.label, module.description)
    );
    const visibleStaticItems = staticItems.filter((item) =>
      matchesSidebarSearch(item.label, item.description)
    );
    const adminModuleById = new Map(adminModules.map((module) => [module.id, module] as const));
    const visibleAdminSidebarGroups = adminSidebarGroups
      .map((group) => ({
        ...group,
        modules: group.moduleIds
          .map((moduleId) => adminModuleById.get(moduleId))
          .filter((module): module is (typeof adminModules)[number] => Boolean(module))
          .filter((module) =>
            matchesSidebarSearch(module.label, compactAdminSidebarDescriptions[module.id] ?? module.description)
          ),
      }))
      .filter((group) => group.modules.length > 0);
    const showAdminOverviewLink =
      !hasSidebarSearch ||
      "pusat kendali ringkasan admin dashboard pengaturan aleta".includes(activeSidebarQuery);
    const showSidebarSearch =
      !collapsed && (isAdminArea || primaryModules.length > 3 || staticItems.length > 1);
    const sidebarSearchPlaceholder = isAdminArea ? "Cari menu admin..." : "Cari menu...";
    const sidebarSearchLabel = isAdminArea ? "Cari menu admin" : "Cari menu";
    const sidebarItemClass = (active: boolean) =>
      cn(
        "relative flex overflow-hidden rounded-2xl border transition",
        collapsed ? "justify-center px-0 py-3" : "items-start gap-3 px-3.5 py-2.5",
        active
          ? cn(
              "border-sky-300/55 bg-sky-300 text-slate-950 shadow-[0_16px_34px_rgba(56,189,248,0.2)]",
              !collapsed &&
                "before:absolute before:bottom-3 before:left-1.5 before:top-3 before:w-1 before:rounded-full before:bg-white/90"
            )
          : "border-transparent text-slate-100 hover:border-white/10 hover:bg-white/10"
      );
    const renderSidebarLink = ({
      itemKey,
      href,
      label,
      description,
      Icon,
      active,
      external,
      badgeCount,
      testId,
    }: {
      itemKey: string;
      href: string;
      label: string;
      description: string;
      Icon: React.ElementType;
      active: boolean;
      external?: boolean;
      badgeCount?: number;
      testId?: string;
    }) => {
      const content = (
        <>
          <span
            className={cn(
              "relative z-10 shrink-0 rounded-xl p-2",
              active ? "bg-white/30 text-slate-950" : "bg-white/10 text-white"
            )}
          >
            <Icon className="h-4 w-4" />
            {badgeCount && badgeCount > 0 ? (
              <span className="absolute -right-1 -top-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {badgeCount}
              </span>
            ) : null}
          </span>
          {!collapsed ? (
            <span className="relative z-10 min-w-0 space-y-0.5">
              <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
                <span className="truncate">{label}</span>
                {external ? <ExternalLink className="h-3 w-3 shrink-0 opacity-70" /> : null}
              </span>
              {!mobile && description ? (
                <span
                  className={cn(
                    "block text-[12px] leading-5",
                    active ? "text-slate-900/75" : "text-slate-300"
                  )}
                >
                  {description}
                </span>
              ) : null}
            </span>
          ) : (
            <span className="sr-only">{label}</span>
          )}
        </>
      );

      if (external) {
        return (
          <a
            key={itemKey}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title={collapsed ? label : undefined}
            className={sidebarItemClass(false)}
          >
            {content}
          </a>
        );
      }

      return (
        <Link
          key={itemKey}
          href={href}
          onClick={() => setMobileSidebarOpen(false)}
          data-testid={testId}
          title={collapsed ? label : undefined}
          className={sidebarItemClass(active)}
        >
          {content}
        </Link>
      );
    };

    return (
      <div
        className={cn(
          "flex flex-col border border-primary/20 bg-[linear-gradient(180deg,rgba(5,20,34,0.98),rgba(8,38,58,0.96))] text-slate-100 shadow-panel backdrop-blur transition-all duration-300",
          mobile ? "h-[calc(100vh-4rem)] rounded-[1.4rem] p-4" : "h-screen rounded-[2rem]",
          collapsed ? "px-3 py-5" : !mobile && "p-5"
        )}
      >
        {/* Top controls */}
        <div className={cn("flex gap-2", collapsed ? "justify-center" : "items-center")}>
          <Button
            asChild
            variant="secondary"
            size={collapsed ? "icon" : "default"}
            className={cn(
              "rounded-2xl border border-white/10 bg-white/10 text-white hover:bg-white/15 hover:text-white",
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
        <div className={cn("space-y-4", mobile ? "mt-4" : "mt-6")}>
          <AletaLogo
            title={sidebarTitle}
            subtitle={sidebarSubtitle}
            size={collapsed || mobile ? "sm" : "md"}
            className={cn(
              "[&_*]:text-white [&_p:last-child]:text-slate-300 [&>div:first-child]:bg-transparent [&_img]:rounded-full",
              collapsed && "justify-center [&>div:last-child]:hidden"
            )}
          />
          {!collapsed && !mobile ? (
            <p className="text-sm leading-7 text-slate-300">{sidebarDescription}</p>
          ) : null}
        </div>

        {showSidebarSearch ? (
          <div className={cn("relative", mobile ? "mt-4" : "mt-5")}>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              aria-label={sidebarSearchLabel}
              className="h-10 rounded-2xl border-white/10 bg-white/[0.07] pl-10 pr-10 text-sm text-white placeholder:text-slate-400 focus-visible:ring-sky-300/40"
              onChange={(event) => setSidebarSearch(event.target.value)}
              placeholder={sidebarSearchPlaceholder}
              value={sidebarSearch}
            />
            {sidebarSearch ? (
              <button
                type="button"
                aria-label={isAdminArea ? "Hapus pencarian menu admin" : "Hapus pencarian menu"}
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-xl text-slate-300 transition hover:bg-white/10 hover:text-white"
                onClick={() => setSidebarSearch("")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Navigation content */}
        <ScrollArea
          className={cn(
            "flex-1",
            mobile ? "mt-4" : isAdminArea && !collapsed ? "mt-5" : "mt-8",
            collapsed || mobile ? "pr-0" : "pr-3"
          )}
        >
          <div className="space-y-6">
            {/* Manajemen Surat primary nav */}
            {appContext === "manajemen_surat" && !isAdminArea && (
              <nav className="space-y-2">
                {visiblePrimaryModules.map((module) => {
                  const Icon = iconMap[module.icon as keyof typeof iconMap] ?? LayoutDashboard;
                  const active = isRouteActive(pathname, searchParams, module.href);
                  return renderSidebarLink({
                    itemKey: module.id,
                    href: module.href,
                    label: module.label,
                    description: module.description,
                    Icon,
                    active,
                    badgeCount: module.id === "surat-masuk" ? inboxNotificationCount : undefined,
                    testId: `sidebar-module-${module.id}`,
                  });
                })}
                {hasSidebarSearch && visiblePrimaryModules.length === 0 ? (
                  <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-slate-300">
                    Menu tidak ditemukan.
                  </p>
                ) : null}
              </nav>
            )}

            {/* Admin module list */}
            {isAdminArea && (
              <div className="space-y-4">
                {!collapsed ? (
                  <p className="px-3.5 text-[11px] uppercase tracking-[0.22em] text-slate-400">
                    Pusat Manajemen Global
                  </p>
                ) : null}

                {showAdminOverviewLink
                  ? renderSidebarLink({
                      itemKey: "admin-overview",
                      href: "/admin",
                      label: "Pusat Kendali",
                      description: "Ringkasan admin ALETA.",
                      Icon: LayoutDashboard,
                      active: pathname === "/admin",
                    })
                  : null}

                {visibleAdminSidebarGroups.map((group) => {
                  const groupOpen = openAdminSidebarGroups[group.id] ?? true;
                  const visibleGroupOpen = hasSidebarSearch || collapsed || groupOpen;

                  return (
                    <div key={group.id} className={cn("space-y-2", collapsed && "space-y-1")}>
                      {!collapsed ? (
                        <button
                          type="button"
                          aria-expanded={visibleGroupOpen}
                          className="flex w-full items-center justify-between rounded-xl px-3.5 py-1.5 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 transition hover:bg-white/5 hover:text-slate-200"
                          onClick={() =>
                            setOpenAdminSidebarGroups((current) => ({
                              ...current,
                              [group.id]: !groupOpen,
                            }))
                          }
                        >
                          <span>{group.label}</span>
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 transition",
                              visibleGroupOpen && "rotate-180"
                            )}
                          />
                        </button>
                      ) : null}

                      {visibleGroupOpen ? (
                        <nav className="space-y-1.5">
                          {group.modules.map((module) => {
                            const Icon = iconMap[module.icon as keyof typeof iconMap] ?? ShieldCheck;
                            const active = isRouteActive(pathname, searchParams, module.href);
                            return renderSidebarLink({
                              itemKey: module.id,
                              href: module.href,
                              label: module.label,
                              description: compactAdminSidebarDescriptions[module.id] ?? module.description,
                              Icon,
                              active,
                              testId: `sidebar-module-${module.id}`,
                            });
                          })}
                        </nav>
                      ) : null}
                    </div>
                  );
                })}

                {hasSidebarSearch && !showAdminOverviewLink && visibleAdminSidebarGroups.length === 0 ? (
                  <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-slate-300">
                    Menu admin tidak ditemukan.
                  </p>
                ) : null}
              </div>
            )}

            {/* Context-specific static nav (aleta_bot, asisten_hakim, patch_notes, panduan) */}
            {staticItems.length > 0 && (
              <nav className="space-y-2">
                {!collapsed ? (
                  <p className="px-3.5 text-[11px] uppercase tracking-[0.22em] text-slate-400">
                    Navigasi
                  </p>
                ) : null}
                {visibleStaticItems.map((item) => {
                  const Icon = item.icon;
                  const active =
                    !item.external && isRouteActive(pathname, searchParams, item.href);
                  return renderSidebarLink({
                    itemKey: item.href,
                    href: item.href,
                    label: item.label,
                    description: item.description ?? "",
                    Icon,
                    active,
                    external: item.external,
                  });
                })}
                {hasSidebarSearch && visibleStaticItems.length === 0 ? (
                  <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-slate-300">
                    Menu tidak ditemukan.
                  </p>
                ) : null}
              </nav>
            )}
          </div>
        </ScrollArea>

        {/* User session card */}
        <div
          className={cn(
            "mt-4 rounded-2xl border border-white/10 bg-white/[0.045]",
            mobile && "hidden",
            collapsed ? "p-2.5" : "p-3"
          )}
        >
          {!collapsed ? (
            <>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Sesi Aktif</p>
              <div className="mt-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-sm font-bold text-white">{currentUser.name}</p>
                  {currentUser.nip?.trim() ? (
                    <p className="mt-1 truncate text-[10px] font-normal text-slate-400">
                      {currentUser.nip}
                    </p>
                  ) : null}
                  <p className="mt-1 truncate text-[11px] text-slate-300">{currentPositionLabel}</p>
                </div>
                <UserAvatar
                  name={currentUser.name}
                  profilePhotoUrl={currentUser.profilePhotoUrl}
                  className="h-10 w-10 rounded-xl"
                />
              </div>
            </>
          ) : (
            <div className="flex justify-center" title={currentUser.name}>
              <UserAvatar
                name={currentUser.name}
                profilePhotoUrl={currentUser.profilePhotoUrl}
                className="h-10 w-10 rounded-xl"
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  // ─── Outer layout ───────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(32,111,154,0.14),transparent_32%),radial-gradient(circle_at_top_right,rgba(217,164,65,0.13),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent)] dark:bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_30%),radial-gradient(circle_at_top_right,rgba(245,158,11,0.1),transparent_28%),linear-gradient(180deg,rgba(5,20,34,0.36),transparent)]" />

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
              "fixed inset-y-0 left-0 z-50 w-[min(320px,calc(100vw-1.5rem))] p-3 transition-transform duration-300 sm:p-4 lg:hidden",
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

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1600px] items-start gap-3 px-3 py-3 sm:gap-6 sm:px-4 sm:py-4 lg:px-6">
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

        <div className="flex min-w-0 flex-1 flex-col gap-4 sm:gap-6">
          {/* Header */}
          <header className="portal-glass-panel rounded-2xl border px-3 py-2 sm:px-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div className="flex min-w-0 items-center gap-3">
                {showHistoryBackButton ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 shrink-0 gap-2 rounded-xl px-3"
                    aria-label="Kembali ke halaman sebelumnya"
                    title="Kembali ke halaman sebelumnya"
                    onClick={handleHistoryBack}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span className="hidden text-sm font-semibold sm:inline">Kembali</span>
                  </Button>
                ) : null}

                {hasSidebar ? (
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0 lg:hidden"
                    onClick={() => setMobileSidebarOpen(true)}
                    aria-label="Buka navigasi"
                  >
                    <Menu className="h-4 w-4" />
                  </Button>
                ) : null}

                <div className="min-w-0">
                  <span className="sr-only">{pageTitle}</span>
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <Badge variant="default">{currentRoleBadge}</Badge>
                    <Badge variant="muted" className="max-w-[220px] truncate">{currentPositionLabel}</Badge>
                    <span className="hidden text-muted-foreground/75 lg:inline" title={pageFocus}>
                      Panel kerja
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex min-w-0 flex-col gap-2 md:items-end xl:flex-row xl:flex-wrap xl:items-center xl:justify-end">
                {appContext === "manajemen_surat" && !isAdminArea ? (
                  <HeaderSearchForm />
                ) : null}

                <div className="flex max-w-full items-center gap-2 self-end overflow-x-auto rounded-2xl border border-border/50 bg-background/25 p-1 sm:gap-2 xl:self-auto xl:border-0 xl:bg-transparent xl:p-0">
                  <ThemeToggle />

                  {isAdminTier ? (
                    <Button variant="outline" size="icon" aria-label="Buka Panel Admin" title="Panel Admin" asChild>
                      <Link href="/admin">
                        <UserCog className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : null}

                  {isAdminTier && hasSystemUpdate ? (
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Update sistem tersedia"
                      title="Update sistem tersedia"
                      className="relative border-amber-400/60 text-amber-600 dark:text-amber-300"
                      asChild
                    >
                      <Link href="/admin/pembaruan-sistem">
                        <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-amber-400 shadow-[0_0_0_3px_rgba(245,158,11,0.18)]" />
                        <PackageCheck className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : null}

                  <span className="hidden h-8 w-px shrink-0 bg-border/70 sm:block" />

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Pusat Tugas dan Notifikasi"
                        title={taskBreakdownTitle}
                        className="relative"
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
                      {hasBellItems ? (
                        <>
                          {visibleBellTasks.map((item) => (
                            <DropdownMenuItem
                              key={item.id}
                              onSelect={() => {
                                markTaskItemsSeen([{ entityType: item.entityType, entityId: item.entityId }]);
                                router.push(item.href);
                              }}
                              className="cursor-pointer"
                            >
                              <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <p className="line-clamp-1 font-medium">{item.title}</p>
                                  {item.priority === "urgent" ? <Badge variant="warning">Mendesak</Badge> : null}
                                  {!item.seen ? <Badge variant="default">Baru</Badge> : null}
                                </div>
                                <p className="line-clamp-1 text-xs text-muted-foreground">{item.sourceLabel}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDateTime(item.createdAt)}
                                </p>
                              </div>
                            </DropdownMenuItem>
                          ))}
                        </>
                      ) : (
                        <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                          Tidak ada tugas baru.
                        </div>
                      )}
                      <DropdownMenuSeparator />
                      {unreadBellTasks.length > 0 ? (
                        <DropdownMenuItem
                          className="justify-center text-xs font-semibold text-muted-foreground focus:bg-muted/50"
                          onSelect={() => markVisibleTasksSeen(unreadBellTasks)}
                        >
                          Tandai Semua Sudah Dilihat
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem
                        className="justify-center text-xs font-semibold text-primary focus:bg-primary/5 active:bg-primary/10"
                        aria-label="Buka Pusat Tugas Selengkapnya"
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
                        disabled={isSigningOut}
                        onSelect={(event) => {
                          event.preventDefault();
                          void handleLogout();
                        }}
                      >
                        {isSigningOut ? (
                          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <LogOut className="mr-2 h-4 w-4" />
                        )}
                        {isSigningOut ? "Keluar..." : "Keluar"}
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
      className="hidden w-full items-center gap-2 sm:flex xl:w-auto"
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
