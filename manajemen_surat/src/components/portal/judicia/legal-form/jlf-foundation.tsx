"use client";

import Link from "next/link";
import {
  Archive,
  Bot,
  BookOpenText,
  Database,
  LayoutDashboard,
  Scale,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { EmptyState } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  JUDICIA_LEGAL_FORM_ADMIN_ROUTE,
  JUDICIA_LEGAL_FORM_ROUTE,
  type JudiciaLegalFormAccess,
  type JudiciaLegalFormAdminTab,
  type JudiciaLegalFormFeatureCard,
} from "@/lib/judicia-legal-form-types";
import { cn } from "@/lib/utils";

const iconMap: Record<string, LucideIcon> = {
  archive: Archive,
  bot: Bot,
  "book-open-text": BookOpenText,
  database: Database,
  "layout-dashboard": LayoutDashboard,
  scale: Scale,
  search: Search,
  send: Send,
  settings: Settings,
  "shield-check": ShieldCheck,
  sparkles: Sparkles,
  "users-round": UsersRound,
};

function getIcon(iconKey: string) {
  return iconMap[iconKey] ?? LayoutDashboard;
}

function roleViewLabel(roleView: JudiciaLegalFormAccess["roleView"]) {
  if (roleView === "superadmin") return "Superadmin";
  if (roleView === "admin") return "Admin";
  return "User";
}

export function JlfLoadingState() {
  return (
    <Card className="border-border/80">
      <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
        <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        Memuat fondasi Judicia Legal Form...
      </CardContent>
    </Card>
  );
}

export function JlfStatusPanel({ access }: { access: JudiciaLegalFormAccess }) {
  const statusItems = [
    "Fondasi modul aktif",
    "Belum membuat migration",
    "SIPP read-only via adapter",
    "AI memakai konfigurasi global ALETA",
    "WhatsApp memakai ALETA Bot global",
  ];

  return (
    <Card className="border-border/80">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <CardTitle>Status Fondasi</CardTitle>
            <CardDescription>
              Shell awal JLF sudah masuk portal ALETA dan tetap mematuhi guardrail human-in-the-loop.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="success">Aktif</Badge>
            <Badge variant="outline">{roleViewLabel(access.roleView)}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {statusItems.map((item) => (
          <div key={item} className="rounded-2xl border border-border/80 bg-muted/30 px-4 py-3 text-sm font-medium text-foreground">
            {item}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function JlfRoleWorkspace({ access }: { access: JudiciaLegalFormAccess }) {
  const items =
    access.roleView === "superadmin"
      ? [
          "Dashboard lengkap",
          "Pengaturan JLF",
          "AI JLF admin",
          "ALETA Bot/WhatsApp JLF admin",
          "SIPP connector setting",
          "Account sync dan role mapping",
          "Audit",
          "Import legacy ABT",
        ]
      : access.roleView === "admin"
        ? [
            "Dashboard pengelolaan",
            "Template dan variabel",
            "Legal Knowledge Base",
            "Account sync jika diizinkan",
            "Pengaturan terbatas",
            "Audit lokal jika diizinkan",
          ]
        : [
            "Mode Cepat Blangko",
            "Cari perkara dan pilih sidang",
            "Review variabel dan data manual",
            access.isValidator ? "Validasi saya" : "Validasi hanya jika diberi permission",
            access.permissions.includes("judicia_legal_form.ai.use") ? "AI assistant" : "AI assistant menunggu permission",
            "Tidak ada konfigurasi teknis",
          ];

  return (
    <Card className="border-border/80">
      <CardHeader>
        <CardTitle>Tampilan {roleViewLabel(access.roleView)}</CardTitle>
        <CardDescription>
          Area kerja JLF disaring dari role, posisi, additional role, dan permission dasar modul.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div key={item} className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card/70 px-4 py-3">
            <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-sm font-medium text-foreground">{item}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function JlfFeatureGrid({ cards }: { cards: JudiciaLegalFormFeatureCard[] }) {
  if (cards.length === 0) {
    return (
      <EmptyState
        title="Belum ada fitur JLF yang dapat dibuka"
        description="Akun ini sudah masuk portal, tetapi belum memiliki permission kerja JLF. Hubungi Admin bila akses diperlukan."
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => {
        const Icon = getIcon(card.iconKey);

        return (
          <Link key={card.id} href={card.href} className="group block">
            <Card className="h-full border-border/80 transition duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-panel">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <Badge variant="outline">{card.badge}</Badge>
                </div>
                <CardTitle className="text-lg">{card.title}</CardTitle>
                <CardDescription>{card.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

export function JlfSelectedSection({
  label,
  description,
  canOpenAdmin,
}: {
  label: string;
  description: string;
  canOpenAdmin: boolean;
}) {
  return (
    <Card className="border-border/80">
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <CardTitle>{label}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Badge variant="warning">Tahap awal</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Area ini sudah disiapkan sebagai shell UI. Fungsi data, engine dokumen, adapter SIPP, AI, dan notifikasi
          akan masuk pada tahap implementasi berikutnya.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={JUDICIA_LEGAL_FORM_ROUTE}>Dashboard</Link>
          </Button>
          {canOpenAdmin ? (
            <Button asChild variant="outline">
              <Link href={JUDICIA_LEGAL_FORM_ADMIN_ROUTE}>
                <Settings className="h-4 w-4" />
                Pengaturan
              </Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function tabChecklist(tab: JudiciaLegalFormAdminTab, aiStatusLabel: string) {
  switch (tab.id) {
    case "koneksi-sipp":
      return [
        "Default adapter memakai ALETA Bot/internal controlled bridge jika endpoint aman tersedia.",
        "Jika bridge belum tersedia, tahap berikutnya memakai adapter stub tanpa raw SQL endpoint.",
        "SIPP tetap read-only dan query harus parameterized.",
      ];
    case "ai":
      return [
        aiStatusLabel,
        "JLF hanya menambah toggle, policy, dan prompt scope khusus modul.",
        "AI adalah asisten draft dan tidak mengambil keputusan hukum.",
      ];
    case "whatsapp":
      return [
        "Gateway global ALETA Bot/WhatsApp digunakan ulang.",
        "JLF tidak menyimpan token WhatsApp baru.",
        "Notifikasi perkara sensitif dibatasi ke link login/otorisasi.",
      ];
    case "legacy-abt":
      return [
        "ABT hanya diperlakukan sebagai legacy/importer.",
        "Tidak ada route baru legacy dan tidak ada prefix tabel legacy untuk fitur baru.",
        "Mapping legacy akan dibuat eksplisit sebelum import data.",
      ];
    case "legal-kb":
      return [
        "Peraturan production harus berstatus terverifikasi sebelum dipakai AI legal analysis.",
        "Relasi template, variabel, pasal, ayat, dan topik hukum disiapkan di tahap schema.",
        "AI tidak boleh mengarang dasar hukum.",
      ];
    default:
      return [
        "Shell UI tahap awal, belum menyimpan konfigurasi baru.",
        "Aksi penting kelak wajib masuk audit trail.",
        "Permission JLF sudah dipisahkan dari fitur kerja pengguna biasa.",
      ];
  }
}

export function JlfAdminTabPanel({
  tab,
  aiStatusLabel,
  className,
}: {
  tab: JudiciaLegalFormAdminTab;
  aiStatusLabel: string;
  className?: string;
}) {
  const checklist = tabChecklist(tab, aiStatusLabel);

  return (
    <Card className={cn("border-border/80", className)}>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <CardTitle>{tab.label}</CardTitle>
            <CardDescription>{tab.description}</CardDescription>
          </div>
          <Badge variant={tab.superAdminOnly ? "default" : "outline"}>
            {tab.superAdminOnly ? "Superadmin" : "Permission-aware"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {checklist.map((item) => (
          <div key={item} className="flex items-start gap-3 rounded-2xl border border-border/80 bg-muted/30 px-4 py-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-sm leading-6 text-muted-foreground">{item}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
