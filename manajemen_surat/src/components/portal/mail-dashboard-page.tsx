"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, BellRing, MessageSquare, SearchCheck, Send } from "lucide-react";

import { WhatsAppControl } from "@/components/portal/whatsapp-control";

import { PageIntro, SectionHint, statusVariant } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePortal } from "@/lib/app-state";
import { getDispositionDeadlineState } from "@/lib/disposition-status";
import { formatDateTime } from "@/lib/format";
import {
  canCreateIncomingLetter,
  canCreateOutgoingLetter,
  canManageActingAssignments,
  getEffectivePosition,
  getPosition,
  getUser,
  getUserRoleBadge,
} from "@/lib/permissions";

export function MailDashboardPage() {
  const { accessibleLetters, currentUser, dispositions, pendingInbox, users } = usePortal();
  const position = getEffectivePosition(currentUser);
  const currentRoleBadge = getUserRoleBadge(currentUser);
  const visibleLetterIds = new Set(accessibleLetters.map((letter) => letter.id));
  const canManageAssignments = canManageActingAssignments(currentUser);
  const canAddIncomingLetter = canCreateIncomingLetter(currentUser);
  const canAddOutgoingLetter = canCreateOutgoingLetter(currentUser);
  const visibleDispositions = dispositions.filter((item) => visibleLetterIds.has(item.suratId));
  const lateDispositionCount = visibleDispositions.filter(
    (item) => item.status !== "Selesai" && getDispositionDeadlineState(item) === "overdue"
  ).length;
  const dueTodayDispositionCount = visibleDispositions.filter(
    (item) => item.status !== "Selesai" && getDispositionDeadlineState(item) === "due_today"
  ).length;
  const stats = [
    {
      id: "surat-masuk",
      label: "Surat Masuk (Total)",
      value: accessibleLetters.filter((letter) => letter.type === "masuk").length,
      hint: "",
      href: "/surat?type=masuk",
    },
    {
      id: "surat-keluar",
      label: "Surat Keluar (Total)",
      value: accessibleLetters.filter((letter) => letter.type === "keluar").length,
      hint: "",
      href: "/surat?type=keluar",
    },
    {
      id: "tugas-masuk",
      label: "Tugas Masuk",
      value: pendingInbox.length,
      hint: "Disposisi yang masih menunggu tindak lanjut Anda.",
      href: "/surat?metric=inbox",
    },
    {
      id: "disposisi-terlambat",
      label: "Disposisi Terlambat",
      value: lateDispositionCount,
      hint: `${dueTodayDispositionCount} jatuh tempo hari ini.`,
      href: "/tugas?filter=Mendesak",
    },
  ];
  const recentActivities = dispositions
    .filter((item) => visibleLetterIds.has(item.suratId))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 6);
  const urgentTasks = pendingInbox.filter((item) => item.urgent).slice(0, 4);
  const fallbackTasks = pendingInbox.slice(0, 4);
  const taskWidget = urgentTasks.length > 0 ? urgentTasks : fallbackTasks;

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Manajemen Surat"
        title="Dashboard Manajemen Surat"
        description={`${currentRoleBadge} · ${position?.name ?? "-"}`}
        actions={
          <>
            {canManageAssignments ? (
              <Button asChild variant="outline">
                <Link href="/penugasan">Kelola PLH/PLT</Link>
              </Button>
            ) : null}
            {canAddIncomingLetter ? (
              <Button asChild variant="outline">
                <Link href="/surat?type=masuk&compose=1">Tambah Surat Masuk</Link>
              </Button>
            ) : null}
            {canAddOutgoingLetter ? (
              <Button asChild variant="outline">
                <Link href="/surat?type=keluar&compose=1">Tambah Surat Keluar</Link>
              </Button>
            ) : null}
            <Button asChild>
              <Link href="/surat?metric=inbox">
                <Send className="h-4 w-4" />
                Buka Tugas
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/search">
                <SearchCheck className="h-4 w-4" />
                Cari Surat
              </Link>
            </Button>
          </>
        }
      />

      <div data-testid="mail-dashboard-summary-grid" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <Link key={item.id} href={item.href} className="group block">
            <Card
              data-testid={`mail-summary-card-${item.id}`}
              className="h-full border-border/80 transition duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-panel"
            >
              <CardHeader className="space-y-1 p-4 pb-2">
                <CardDescription className="text-[11px] uppercase tracking-[0.14em]">{item.label}</CardDescription>
                <CardTitle className="text-2xl sm:text-3xl">{item.value}</CardTitle>
              </CardHeader>
              <CardContent className="flex min-h-10 items-center justify-between gap-3 px-4 pb-4 pt-0">
                {item.hint ? (
                  <p className="text-xs leading-5 text-muted-foreground">{item.hint}</p>
                ) : (
                  <span />
                )}
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-primary" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {currentUser?.roleId === "super-admin" && (
        <div className="grid gap-6">
          <WhatsAppControl />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.14fr_0.86fr]">
        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary" />
              Widget Tugas Mendesak
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {taskWidget.length === 0 ? (
              <SectionHint
                icon="inbox"
                title="Tidak ada tugas mendesak"
                description="Inbox Anda sedang bersih. Gunakan daftar surat untuk meninjau arsip atau pekerjaan baru."
                href="/surat?metric=inbox"
              />
            ) : (
              taskWidget.map((item) => {
                const letter = accessibleLetters.find((entry) => entry.id === item.suratId);

                return (
                  <div key={item.id} className="rounded-[1.2rem] border border-border bg-card/80 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <p className="font-semibold text-foreground">{letter?.perihal ?? "Surat terkait"}</p>
                        <p className="text-sm leading-7 text-muted-foreground">{item.instruksi}</p>
                      </div>
                      {item.urgent ? <Badge variant="danger">Mendesak</Badge> : <Badge variant="outline">Aktif</Badge>}
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>{formatDateTime(item.createdAt)}</span>
                      <span>-</span>
                      <span>Perlu ditindaklanjuti</span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Button asChild size="sm">
                        <Link href={`/disposisi/${item.id}`}>Tindak lanjuti</Link>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/surat/${item.suratId}`}>Lihat surat</Link>
                      </Button>
                    </div>
                  </div>
                );
              })
            )}

          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellRing className="h-5 w-5 text-primary" />
              Log Aktivitas Terbaru
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentActivities.length === 0 ? (
              <SectionHint
                icon="inbox"
                title="Belum ada aktivitas"
                description="Log disposisi akan muncul otomatis ketika surat mulai diteruskan atau ditindaklanjuti."
                href="/surat"
              />
            ) : (
              recentActivities.map((item) => {
                const sender = getUser(item.pengirimId, users);
                const recipient = getUser(item.penerimaId, users);
                const positionLabel = getPosition(item.targetPositionId)?.name ?? "-";

                return (
                  <div key={item.id} className="rounded-[1.2rem] border border-border bg-muted/35 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground">
                          {sender?.name ?? "-"} ke {recipient?.name ?? "-"}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">{positionLabel}</p>
                      </div>
                      <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.instruksi}</p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                      <span>{formatDateTime(item.createdAt)}</span>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/disposisi/${item.id}`}>Buka disposisi</Link>
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
