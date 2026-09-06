"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  Phone,
  Smartphone,
} from "lucide-react";
import type { SVGProps } from "react";

import { AletaLogo } from "@/components/branding/aleta-logo";
import { Badge } from "@/components/ui/badge";
import { usePortal } from "@/lib/app-state";
import { APP_VERSION } from "@/lib/patch-notes";
import { capBuildTerbaca } from "@/lib/build-stamp";

const COPYRIGHT_URL = "https://www.instagram.com/derrybriantono?igsh=M2VtOGljMGJkOXBt";

function InstagramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" {...props}>
      <rect width="16" height="16" x="4" y="4" rx="4" />
      <circle cx="12" cy="12" r="3.4" />
      <circle cx="17" cy="7" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FacebookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" {...props}>
      <path d="M14 8h2V4h-2.5A4.5 4.5 0 0 0 9 8.5V11H6v4h3v5h4v-5h3l1-4h-4V8.5A.5.5 0 0 1 13.5 8H14Z" />
    </svg>
  );
}

function YoutubeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" {...props}>
      <rect width="18" height="13" x="3" y="5.5" rx="3" />
      <path d="m10.5 9 5 3-5 3V9Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ensureWebUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

function normalizeWhatsappNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits;
}

function buildGmailComposeUrl(email: string) {
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email.trim())}`;
}

function looksLikeWebAddress(value: string) {
  return /^(https?:\/\/|www\.|maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.|google\.)/i.test(value.trim());
}

export function buildMapsUrl(address: string, mapUrl?: string) {
  const mapTarget = mapUrl?.trim();
  if (mapTarget) {
    if (looksLikeWebAddress(mapTarget)) return ensureWebUrl(mapTarget);
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapTarget)}`;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`;
}

function buildInstagramUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const handle = trimmed.replace(/^@/, "");
  if (!/\s/.test(handle)) return `https://www.instagram.com/${encodeURIComponent(handle)}`;
  return `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(trimmed)}`;
}

function buildFacebookUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (!/\s/.test(trimmed)) return `https://www.facebook.com/${encodeURIComponent(trimmed)}`;
  return `https://www.facebook.com/search/top?q=${encodeURIComponent(trimmed)}`;
}

function buildYoutubeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("@")) return `https://www.youtube.com/${encodeURIComponent(trimmed)}`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(trimmed)}`;
}

export function PortalFooter() {
  const pathname = usePathname();
  const { currentUser, institutionIdentity, panelSettings } = usePortal();
  const isAdminUser = currentUser?.roleId === "super-admin" || currentUser?.roleId === "admin";

  const contactItems = [
    {
      icon: MapPin,
      label: "Alamat",
      value: institutionIdentity.address,
      href: institutionIdentity.address ? buildMapsUrl(institutionIdentity.address, institutionIdentity.mapUrl) : "",
      external: true,
    },
    {
      icon: Phone,
      label: "Telepon",
      value: institutionIdentity.phoneNumber,
      href: institutionIdentity.phoneNumber ? `tel:${institutionIdentity.phoneNumber.replace(/[^\d+]/g, "")}` : "",
      external: false,
    },
    {
      icon: Smartphone,
      label: "CS WhatsApp",
      value: institutionIdentity.csWhatsappNumber || institutionIdentity.mobilePhone,
      href: (institutionIdentity.csWhatsappNumber || institutionIdentity.mobilePhone)
        ? `https://wa.me/${normalizeWhatsappNumber(institutionIdentity.csWhatsappNumber || institutionIdentity.mobilePhone)}`
        : "",
      external: true,
    },
    {
      icon: Smartphone,
      label: "WhatsApp Bot",
      value: institutionIdentity.botWhatsappNumber,
      href: institutionIdentity.botWhatsappNumber
        ? `https://wa.me/${normalizeWhatsappNumber(institutionIdentity.botWhatsappNumber)}`
        : "",
      external: true,
    },
    {
      icon: Mail,
      label: "Email",
      value: institutionIdentity.email,
      href: institutionIdentity.email ? buildGmailComposeUrl(institutionIdentity.email) : "",
      external: true,
    },
  ].filter((item) => Boolean(item.value));

  const compactContactItems = contactItems.filter((item) =>
    ["Alamat", "CS WhatsApp", "Email"].includes(item.label)
  );

  const digitalItems = [
    {
      icon: Globe,
      label: "Website",
      value: institutionIdentity.website,
      href: institutionIdentity.website ? ensureWebUrl(institutionIdentity.website) : "",
    },
    {
      icon: InstagramIcon,
      label: "Instagram",
      value: institutionIdentity.instagram,
      href: institutionIdentity.instagram ? buildInstagramUrl(institutionIdentity.instagram) : "",
    },
    {
      icon: FacebookIcon,
      label: "Facebook",
      value: institutionIdentity.facebook,
      href: institutionIdentity.facebook ? buildFacebookUrl(institutionIdentity.facebook) : "",
    },
    {
      icon: YoutubeIcon,
      label: "YouTube",
      value: institutionIdentity.youtube,
      href: institutionIdentity.youtube ? buildYoutubeUrl(institutionIdentity.youtube) : "",
    },
  ].filter((item) => Boolean(item.value));

  const useFullFooter =
    panelSettings.footerMode === "full" ||
    (panelSettings.footerMode === "auto" && pathname === "/portal");
  const modeLabel =
    panelSettings.footerMode === "auto"
      ? "Otomatis"
      : panelSettings.footerMode === "full"
        ? "Lengkap"
        : "Ringkas";

  if (!useFullFooter) {
    return (
      <footer className="rounded-2xl border border-border/85 bg-card/90 px-4 py-3 shadow-sm backdrop-blur sm:px-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <AletaLogo
              title={institutionIdentity.courtShortName}
              subtitle={[`ALETA v${APP_VERSION}`, capBuildTerbaca(), `Footer ${modeLabel}`]
                .filter(Boolean)
                .join(" | ")}
              size="sm"
            />
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {compactContactItems.map((item) => {
              const Icon = item.icon;

              return (
                <a
                  key={item.label}
                  href={item.href}
                  target={item.external ? "_blank" : undefined}
                  rel={item.external ? "noopener noreferrer" : undefined}
                  className="group inline-flex max-w-full items-center gap-2 rounded-xl border border-border/75 bg-background/35 px-3 py-2 transition hover:border-primary/40 hover:text-primary"
                  aria-label={`Buka ${item.label}: ${item.value}`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="max-w-[180px] truncate sm:max-w-[260px]">{item.value}</span>
                </a>
              );
            })}
            {digitalItems.slice(0, 4).map((item) => {
              const Icon = item.icon;

              return (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={item.label}
                  aria-label={`Buka ${item.label}: ${item.value}`}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/75 bg-background/35 text-muted-foreground transition hover:border-primary/40 hover:text-primary"
                >
                  <Icon className="h-4 w-4" />
                </a>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <Link href="/patch-notes" className="font-medium text-primary underline-offset-4 hover:underline">
              Catatan Pembaruan
            </Link>
            <Link href="/panduan" className="font-medium text-primary underline-offset-4 hover:underline">
              Panduan
            </Link>
            <Link href="/masukan" className="font-medium text-primary underline-offset-4 hover:underline">
              Masukan
            </Link>
          </div>
        </div>
        <div className="mt-3 border-t border-border/70 pt-3 text-[11px] leading-5 text-muted-foreground">
          <a
            href={COPYRIGHT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline-offset-4 transition hover:text-primary hover:underline"
          >
            Copyright &copy; 2025 Derry Briantono
          </a>
        </div>
      </footer>
    );
  }

  return (
    <footer className="relative overflow-hidden rounded-2xl border border-border/90 bg-[linear-gradient(180deg,hsl(var(--card)/0.96),hsl(var(--muted)/0.42))] p-4 shadow-sm backdrop-blur sm:p-6 sm:shadow-panel">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.14),transparent_70%)]" />

      <div className="relative space-y-5">
        <div className="grid gap-5 xl:grid-cols-[minmax(240px,0.85fr)_minmax(420px,1.45fr)_minmax(260px,0.75fr)]">
          <div className="space-y-4">
            <AletaLogo
              title={institutionIdentity.courtShortName}
              subtitle={`${institutionIdentity.courtName} | ALETA`}
              size="md"
            />
            <p className="max-w-md text-sm leading-7 text-muted-foreground">
              ALETA menyatukan surat, pemberitahuan, bantuan bot, dan pekerjaan kantor dalam satu tempat yang rapi, aman, dan mudah digunakan.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="muted" className="w-fit">Footer {modeLabel}</Badge>
              {capBuildTerbaca() ? (
                <Badge variant="muted" className="w-fit font-mono">{capBuildTerbaca()}</Badge>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card/92 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">Kontak Utama</p>
              <Badge variant="muted">Resmi</Badge>
            </div>
            <div className="divide-y divide-border/80">
              {contactItems.map((item) => {
                const Icon = item.icon;

                return (
                  <a
                    key={item.label}
                    href={item.href}
                    target={item.external ? "_blank" : undefined}
                    rel={item.external ? "noopener noreferrer" : undefined}
                    aria-label={`Buka ${item.label}: ${item.value}`}
                    className="group flex items-start gap-3 rounded-xl py-3 transition first:pt-0 last:pb-0 hover:text-primary"
                  >
                    <span className="mt-0.5 rounded-xl border border-border/80 bg-primary/8 p-2 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{item.label}</p>
                      <p className="mt-1 break-words text-sm leading-6 text-foreground transition group-hover:text-primary">
                        {item.value}
                      </p>
                    </div>
                    <ExternalLink className="mt-2 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                  </a>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card/92 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">Kanal Digital</p>
            </div>
            {digitalItems.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {digitalItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <a
                      key={item.label}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Buka ${item.label}: ${item.value}`}
                      title={item.value}
                      className="group flex min-w-0 items-center gap-2 rounded-xl border border-border/70 bg-background/35 px-3 py-3 transition hover:border-primary/40 hover:text-primary"
                    >
                      <span className="rounded-lg bg-primary/8 p-2 text-primary">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground transition group-hover:text-primary">{item.label}</p>
                        <p className="truncate text-xs text-muted-foreground">{item.value}</p>
                      </div>
                    </a>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border/85 bg-muted/28 px-4 py-4 text-sm text-muted-foreground">
                Kanal digital belum diisi.
                {isAdminUser ? " Lengkapi dari menu Identitas Instansi." : null}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/92 px-4 py-3 text-sm shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <p className="font-semibold text-foreground">{institutionIdentity.courtName}</p>
            {isAdminUser ? (
              <p className="hidden text-muted-foreground sm:block">
              Identitas instansi, kontak, dan kanal digital dapat dikelola dari menu Identitas Instansi oleh Admin atau Super Admin.
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              ALETA v{APP_VERSION} <span className="px-1">|</span>
              <Link href="/patch-notes" className="font-medium text-primary underline-offset-4 transition hover:underline">
                Catatan Pembaruan
              </Link>
              <span className="px-1">|</span>
              <Link href="/panduan" className="font-medium text-primary underline-offset-4 transition hover:underline">
                Panduan Penggunaan
              </Link>
              <span className="px-1">|</span>
              <Link href="/masukan" className="font-medium text-primary underline-offset-4 transition hover:underline">
                Beri Masukan
              </Link>
            </p>
            <a
              href={COPYRIGHT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex text-[11px] font-medium text-muted-foreground underline-offset-4 transition hover:text-primary hover:underline"
            >
              Copyright &copy; 2025 Derry Briantono
            </a>
          </div>
          <div className="hidden flex-wrap items-center gap-2 md:flex">
            <Badge variant="success">Portal ALETA aktif</Badge>
          </div>
        </div>
      </div>
    </footer>
  );
}
