"use client";

import { CheckCircle2, Cloud, Copy, ExternalLink, Globe, LoaderCircle, Server, ShieldCheck, Wifi } from "lucide-react";
import { useMemo, useState } from "react";

import { AccessDeniedCard, PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { normalizePublicUrl } from "@/lib/panel-settings";
import { getEffectiveRoleId } from "@/lib/permissions";
import { type PublicAccessSettings } from "@/lib/types";
import { usePortal } from "@/lib/app-state";
import { cn } from "@/lib/utils";

const methodOptions: Array<{
  value: PublicAccessSettings["method"];
  label: string;
  description: string;
  icon: typeof Globe;
}> = [
  {
    value: "domain",
    label: "Domain / Subdomain",
    description: "Pakai domain resmi yang diarahkan ke IP publik server, lalu masuk lewat reverse proxy HTTPS.",
    icon: Globe,
  },
  {
    value: "cloudflare-tunnel",
    label: "Tunnel Aman",
    description: "Cocok jika kantor belum punya IP publik atau port server tidak bisa dibuka dari luar.",
    icon: Cloud,
  },
  {
    value: "vpn",
    label: "VPN Internal",
    description: "Cocok bila akses hanya untuk pegawai, tetap dari jaringan luar tetapi lewat VPN kantor.",
    icon: ShieldCheck,
  },
];

function parseHttpUrl(value: string) {
  const normalized = normalizePublicUrl(value);
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function isLocalOrPrivateHost(hostname: string) {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local")) return true;
  if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return true;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return true;
  return false;
}

function buildSuggestedPublicUrl(website?: string) {
  const sourceUrl = parseHttpUrl(website ?? "");
  if (!sourceUrl) return "https://aleta.nama-domain.go.id";

  const baseHost = sourceUrl.hostname.replace(/^www\./i, "");
  return `https://aleta.${baseHost}`;
}

export function PublicAccessPanel() {
  const { currentUser, institutionIdentity, panelSettings, updatePanelSettings } = usePortal();
  const effectiveRoleId = getEffectiveRoleId(currentUser);
  const isAllowed = effectiveRoleId === "super-admin" || effectiveRoleId === "admin";
  const [publicUrl, setPublicUrl] = useState(panelSettings.publicAccess.publicUrl);
  const [method, setMethod] = useState<PublicAccessSettings["method"]>(panelSettings.publicAccess.method);
  const [notes, setNotes] = useState(panelSettings.publicAccess.notes);
  const [localOrigin] = useState(() => (typeof window === "undefined" ? "" : window.location.origin));
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [copied, setCopied] = useState(false);

  const normalizedPublicUrl = normalizePublicUrl(publicUrl);
  const parsedPublicUrl = parseHttpUrl(publicUrl);
  const suggestedPublicUrl = useMemo(
    () => buildSuggestedPublicUrl(institutionIdentity.website),
    [institutionIdentity.website]
  );
  const selectedMethod = methodOptions.find((option) => option.value === method) ?? methodOptions[0];
  const hostLooksPrivate = parsedPublicUrl ? isLocalOrPrivateHost(parsedPublicUrl.hostname) : false;
  const hasChanges =
    normalizedPublicUrl !== panelSettings.publicAccess.publicUrl ||
    method !== panelSettings.publicAccess.method ||
    notes.trim() !== panelSettings.publicAccess.notes;

  if (!isAllowed) {
    return (
      <div className="space-y-6">
        <PageIntro
          eyebrow="Akses Internet"
          title="Akses Publik"
          description="Pengaturan alamat publik hanya dapat dibuka oleh Admin atau Super Admin."
        />
        <AccessDeniedCard />
      </div>
    );
  }

  const saveSettings = async () => {
    setFeedback("");
    setCopied(false);

    if (publicUrl.trim() && !parsedPublicUrl) {
      setFeedback("Alamat publik belum valid. Gunakan format seperti https://aleta.domain.go.id.");
      return;
    }

    setIsSaving(true);
    const result = await updatePanelSettings({
      publicAccess: {
        publicUrl: normalizedPublicUrl,
        method,
        notes,
      },
    });
    setFeedback(result.message);
    setIsSaving(false);
  };

  const copyPublicUrl = async () => {
    if (!normalizedPublicUrl) return;
    await navigator.clipboard.writeText(normalizedPublicUrl);
    setCopied(true);
    setFeedback("Alamat publik berhasil disalin.");
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Akses Internet"
        title="Akses Publik ALETA"
        description="Simpan alamat domain publik agar admin punya satu tempat untuk membuka ALETA dari internet atau WiFi lain."
        actions={
          normalizedPublicUrl && parsedPublicUrl ? (
            <Button asChild>
              <a href={normalizedPublicUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                Buka Alamat Publik
              </a>
            </Button>
          ) : null
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(330px,0.8fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <CardTitle>Alamat Publik Aplikasi</CardTitle>
                  <CardDescription>
                    Isi dengan domain/subdomain yang sudah diarahkan ke server ALETA, misalnya https://aleta.pa-donggala.go.id.
                  </CardDescription>
                </div>
                <Badge variant={hasChanges ? "warning" : "success"}>
                  {hasChanges ? "Belum Disimpan" : "Tersimpan"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <label className="block space-y-2 text-sm font-medium text-foreground">
                URL publik
                <Input
                  value={publicUrl}
                  onChange={(event) => {
                    setPublicUrl(event.target.value);
                    setFeedback("");
                    setCopied(false);
                  }}
                  placeholder={suggestedPublicUrl}
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPublicUrl(suggestedPublicUrl)}
                >
                  Pakai Saran Domain
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void copyPublicUrl()}
                  disabled={!normalizedPublicUrl}
                >
                  {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Tersalin" : "Salin Link"}
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {methodOptions.map((option) => {
                  const Icon = option.icon;
                  const selected = option.value === method;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setMethod(option.value)}
                      className={cn(
                        "rounded-2xl border p-4 text-left transition",
                        selected
                          ? "border-primary/60 bg-primary/10 text-foreground shadow-panel"
                          : "border-border bg-card/70 text-muted-foreground hover:border-primary/35 hover:text-foreground"
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 font-semibold">
                          <Icon className="h-4 w-4" />
                          {option.label}
                        </span>
                        {selected ? <CheckCircle2 className="h-4 w-4 text-primary" /> : null}
                      </div>
                      <p className="mt-3 text-sm leading-6">{option.description}</p>
                    </button>
                  );
                })}
              </div>

              <label className="block space-y-2 text-sm font-medium text-foreground">
                Metode akses
                <NativeSelect
                  value={method}
                  onChange={(event) => setMethod(event.target.value as PublicAccessSettings["method"])}
                >
                  {methodOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </NativeSelect>
              </label>

              <label className="block space-y-2 text-sm font-medium text-foreground">
                Catatan admin
                <Textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Contoh: DNS sudah diarahkan ke IP publik server, HTTPS memakai reverse proxy Nginx."
                  rows={4}
                />
              </label>

              <div className="flex flex-col gap-3 border-t border-border/80 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-6 text-muted-foreground">
                  Halaman ini menyimpan link dan checklist. DNS, port, HTTPS, dan reverse proxy tetap perlu diatur di server/jaringan.
                </p>
                <Button onClick={() => void saveSettings()} disabled={isSaving || !hasChanges}>
                  {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {isSaving ? "Menyimpan..." : hasChanges ? "Simpan Alamat" : "Sudah Tersimpan"}
                </Button>
              </div>

              {feedback ? (
                <div className="rounded-xl border border-border bg-muted/35 px-4 py-3 text-sm text-muted-foreground">
                  {feedback}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status Akses</CardTitle>
              <CardDescription>{selectedMethod.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-2xl border border-border bg-background/45 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-primary/10 p-3 text-primary">
                    <Wifi className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold text-foreground">Alamat lokal saat ini</p>
                    <p className="break-all text-sm text-muted-foreground">{localOrigin || "Sedang dibaca..."}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-background/45 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-primary/10 p-3 text-primary">
                    <Globe className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold text-foreground">Alamat publik tersimpan</p>
                    {normalizedPublicUrl ? (
                      <a
                        href={normalizedPublicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all text-sm font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {normalizedPublicUrl}
                      </a>
                    ) : (
                      <p className="text-sm text-muted-foreground">Belum diisi.</p>
                    )}
                    {hostLooksPrivate ? (
                      <p className="text-sm leading-6 text-amber-600 dark:text-amber-300">
                        Alamat ini masih terlihat seperti IP lokal/private. Untuk akses internet, gunakan domain publik atau tunnel.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Checklist Server</CardTitle>
              <CardDescription>Yang perlu aktif agar URL publik benar-benar bisa dibuka dari WiFi lain.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
              <div className="flex gap-3 rounded-2xl border border-border bg-background/45 p-4">
                <Server className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p>Domain/subdomain diarahkan ke IP publik server atau endpoint tunnel.</p>
              </div>
              <div className="flex gap-3 rounded-2xl border border-border bg-background/45 p-4">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p>HTTPS aktif melalui reverse proxy seperti Nginx/Apache/Caddy atau Cloudflare Tunnel.</p>
              </div>
              <div className="flex gap-3 rounded-2xl border border-border bg-background/45 p-4">
                <Wifi className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p>Firewall/router mengizinkan akses web yang dibutuhkan. Jangan buka port database atau session WhatsApp ke publik.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
