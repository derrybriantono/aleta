"use client";

import { AtSign, Globe, Link2, Mail, MapPin, Phone, Smartphone } from "lucide-react";

import { AletaLogo } from "@/components/branding/aleta-logo";
import { Badge } from "@/components/ui/badge";
import { usePortal } from "@/lib/app-state";

export function PortalFooter() {
  const { institutionIdentity } = usePortal();

  const contactItems = [
    { icon: MapPin, label: "Alamat", value: institutionIdentity.address },
    { icon: Phone, label: "Telepon", value: institutionIdentity.phoneNumber },
    { icon: Smartphone, label: "WhatsApp", value: institutionIdentity.mobilePhone },
    { icon: Mail, label: "Email", value: institutionIdentity.email },
  ].filter((item) => Boolean(item.value));

  const digitalItems = [
    { icon: Globe, label: "Website", value: institutionIdentity.website },
    { icon: AtSign, label: "Instagram", value: institutionIdentity.instagram },
    { icon: Link2, label: "Facebook", value: institutionIdentity.facebook },
    { icon: Link2, label: "YouTube", value: institutionIdentity.youtube },
  ].filter((item) => Boolean(item.value));

  return (
    <footer className="relative overflow-hidden rounded-[2.15rem] border border-border/95 bg-[linear-gradient(180deg,hsl(var(--card)/0.98),hsl(var(--muted)/0.54))] p-6 shadow-panel backdrop-blur sm:p-7">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(28,84,126,0.16),transparent_68%)] dark:bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.16),transparent_68%)]" />

      <div className="relative space-y-6">
        <div className="grid gap-6 xl:grid-cols-[1.08fr_0.96fr_0.96fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="w-fit">
                Identitas Instansi
              </Badge>
              <Badge variant="muted">ALETA</Badge>
            </div>
            <AletaLogo
              title={institutionIdentity.courtShortName}
              subtitle={`${institutionIdentity.courtName} | ALETA`}
              size="md"
            />
            <p className="max-w-md text-sm leading-7 text-muted-foreground">
              ALETA menjaga persuratan, disposisi, arsip, dan layanan digital internal tetap terhubung dalam satu workspace yang rapi dan mudah dipakai.
            </p>
          </div>

          <div className="rounded-[1.5rem] border border-border bg-card/96 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">Kontak Utama</p>
              <Badge variant="muted">Resmi</Badge>
            </div>
            <div className="divide-y divide-border/80">
              {contactItems.map((item) => {
                const Icon = item.icon;

                return (
                  <div key={item.label} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="mt-0.5 rounded-xl border border-border/80 bg-primary/8 p-2 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{item.label}</p>
                      <p className="mt-1 text-sm leading-6 text-foreground">{item.value}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-border bg-card/96 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">Kanal Digital</p>
              <Badge variant="outline">Tersinkron</Badge>
            </div>
            {digitalItems.length > 0 ? (
              <div className="divide-y divide-border/80">
                {digitalItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div key={item.label} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                      <span className="mt-0.5 rounded-xl border border-border/80 bg-primary/8 p-2 text-primary">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{item.label}</p>
                        <p className="mt-1 text-sm leading-6 text-foreground">{item.value}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-[1rem] border border-dashed border-border/85 bg-muted/28 px-4 py-4 text-sm text-muted-foreground">
                Kanal digital belum diisi. Admin atau Super Admin dapat melengkapinya dari menu Identitas Instansi.
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-[1.35rem] border border-border bg-card shadow-sm px-5 py-4 text-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <p className="font-semibold text-foreground">{institutionIdentity.courtName}</p>
            <p className="text-muted-foreground">
              Identitas instansi, kontak, dan kanal digital dapat dikelola dari menu Identitas Instansi oleh Admin atau Super Admin.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {institutionIdentity.phoneNumber ? <Badge variant="outline">{institutionIdentity.phoneNumber}</Badge> : null}
            {institutionIdentity.email ? <Badge variant="outline">{institutionIdentity.email}</Badge> : null}
            <Badge variant="success">Portal ALETA aktif</Badge>
          </div>
        </div>
      </div>
    </footer>
  );
}
