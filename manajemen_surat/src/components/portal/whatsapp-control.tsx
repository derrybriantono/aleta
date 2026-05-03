"use client";

import Link from "next/link";
import { ArrowRight, MessageSquare, RefreshCcw, Smartphone } from "lucide-react";

import {
  getWhatsAppRuntimeDisplayLabel,
  getWhatsAppRuntimeLabel,
  getWhatsAppRuntimeMessage,
  useWhatsAppGateway,
} from "@/components/portal/use-whatsapp-gateway";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function runtimeVariant(status: ReturnType<typeof getWhatsAppRuntimeLabel>) {
  if (status === "connected") return "success" as const;
  if (status === "failed") return "danger" as const;
  return "outline" as const;
}

export function WhatsAppControl() {
  const { snapshot, refresh, isRefreshing } = useWhatsAppGateway(true);
  const runtimeLabel = getWhatsAppRuntimeLabel(snapshot.runtimeStatus);
  const runtimeDisplayLabel = getWhatsAppRuntimeDisplayLabel(snapshot.runtimeStatus);
  const phonePolicy = snapshot.requiresPhoneNumberBeforeInit
    ? "Isi nomor resmi sebelum menyiapkan QR."
    : "Nomor resmi dapat diisi setelah koneksi disiapkan.";

  return (
    <Card className="overflow-hidden border-border/80" data-testid="wa-summary-card">
      <CardHeader className="border-b border-primary/10 bg-primary/5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-2">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-1">
              <CardTitle>Ringkasan WhatsApp Gateway</CardTitle>
              <CardDescription>
                Koneksi, QR, dan sesi WhatsApp dikelola dari satu halaman agar admin tidak membuka dua alur koneksi sekaligus.
              </CardDescription>
            </div>
          </div>
          <Badge variant={runtimeVariant(runtimeLabel)}>
            {runtimeDisplayLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryItem
            label="Layanan"
            value={runtimeDisplayLabel}
            description={getWhatsAppRuntimeMessage(snapshot.runtimeStatus)}
            valueTestId="wa-summary-runtime-value"
          />
          <SummaryItem
            label="Nomor Resmi"
            value={snapshot.phoneNumber.trim() || "Belum disetel"}
            description={phonePolicy}
          />
          <SummaryItem
            label="Nama Sesi"
            value={snapshot.sessionName}
            description="Nama sesi yang digunakan layanan WhatsApp."
          />
          <SummaryItem
            label="Terakhir Terhubung"
            value={
              snapshot.lastConnectedAt
                ? new Date(snapshot.lastConnectedAt).toLocaleString("id-ID")
                : "Belum pernah"
            }
            description="Riwayat koneksi terakhir yang tersimpan."
          />
        </div>

        <div className="rounded-[1.2rem] border border-dashed border-border bg-muted/35 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Koneksi dikelola dari satu tempat</p>
              <p className="text-sm leading-6 text-muted-foreground">
                Jika status <strong className="text-foreground">Perlu Scan QR</strong>, QR hanya ditampilkan di halaman pusat WhatsApp. Kartu ini hanya ringkasan agar tidak ada dua tombol koneksi yang saling bertentangan.
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card text-primary shadow-sm">
              <Smartphone className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-border pt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <RefreshCcw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
            <span>{getWhatsAppRuntimeMessage(snapshot.runtimeStatus)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs text-muted-foreground"
              onClick={() => void refresh()}
            >
              Perbarui status
            </Button>
            <Button asChild size="sm">
              <Link href="/admin/status-whatsapp">
                Buka Pusat Koneksi
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryItem({
  label,
  value,
  description,
  valueTestId,
}: {
  label: string;
  value: string;
  description: string;
  valueTestId?: string;
}) {
  return (
    <div className="rounded-[1.15rem] border border-border bg-card/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-semibold text-foreground" data-testid={valueTestId}>
        {value}
      </p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p>
    </div>
  );
}
