import Link from "next/link";
import { ArrowRight, FileSearch, Inbox, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type DashboardMetric, type LetterStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function statusVariant(status: LetterStatus | string) {
  if (status === "Selesai") return "success";
  if (status === "Dalam Disposisi" || status === "Sedang Dikerjakan" || status === "Diteruskan") return "warning";
  if (status === "Rahasia" || status === "Terputus") return "danger";
  return "muted";
}

export function MetricCard({ metric }: { metric: DashboardMetric }) {
  return (
    <Card className="border-border/80">
        <CardHeader className="pb-3">
          <CardDescription className="uppercase tracking-[0.2em]">{metric.label}</CardDescription>
          <CardTitle className="text-3xl sm:text-4xl">{metric.value}</CardTitle>
        </CardHeader>
      <CardContent>
        <p className="text-base text-muted-foreground">{metric.hint}</p>
      </CardContent>
    </Card>
  );
}

export function MetricLinkCard({
  metric,
  href,
}: {
  metric: DashboardMetric;
  href: string;
}) {
  return (
    <Link href={href} className="group block">
      <Card className="border-border/80 transition duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-panel">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <CardDescription className="uppercase tracking-[0.2em]">{metric.label}</CardDescription>
            <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:text-primary" />
          </div>
          <CardTitle className="text-3xl sm:text-4xl">{metric.value}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-base text-muted-foreground">{metric.hint}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

export function PageIntro({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-2">
        <p className="text-[0.78rem] font-semibold uppercase tracking-[0.24em] text-primary">{eyebrow}</p>
        <h1 className="font-serif text-3xl leading-tight text-foreground sm:text-[2.6rem]">{title}</h1>
        <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}

export function SectionHint({
  icon,
  title,
  description,
  href,
  className,
}: {
  icon?: "search" | "security" | "inbox";
  title: string;
  description: string;
  href?: string;
  className?: string;
}) {
  const Icon = icon === "security" ? ShieldAlert : icon === "inbox" ? Inbox : FileSearch;

  return (
    <Card className={cn("border-dashed border-border bg-muted/40", className)}>
      <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-card p-3 text-primary shadow-sm">
            <Icon className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            <p className="text-base text-muted-foreground">{description}</p>
          </div>
        </div>
        {href ? (
          <Button asChild variant="outline">
            <Link href={href}>
              Buka
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function AccessDeniedCard() {
  return (
    <SectionHint
      icon="security"
      title="Akses modul dibatasi"
      description="Role aktif saat ini tidak memiliki akses ke halaman ini. Masuk dengan akun yang memiliki izin admin untuk membuka area ini."
      href="/portal"
    />
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[1.4rem] border border-dashed border-border bg-card/60 px-6 py-12 text-center">
      <div className="mx-auto max-w-xl space-y-3">
        <Badge variant="muted" className="mx-auto w-fit">
          Data mock frontend
        </Badge>
        <h3 className="font-serif text-2xl text-foreground">{title}</h3>
        <p className="text-base text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
