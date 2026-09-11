"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, BellRing, MessageSquare, SearchCheck, Send } from "lucide-react";

import { WhatsAppControl } from "@/components/portal/whatsapp-control";
import {
  ItemGeser,
  PenataDasbor,
  SusunanGeser,
  TombolKembalikanSusunan,
} from "@/components/portal/susunan-geser";

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

/**
 * ============================================================================
 * DASBOR YANG DAPAT DISUSUN SENDIRI OLEH TIAP PENGGUNA
 * ============================================================================
 *
 * Dasbor ini dibuka tiap pagi oleh jabatan yang pekerjaannya berbeda-beda.
 * Panitera pengganti mencari tugas masuk, kepala bagian umum mencari surat
 * masuk, dan sampai kini keduanya harus melewati kartu yang bukan urusannya
 * karena urutannya dipatok di kode.
 *
 * Sekarang tiap kartu dapat ditahan lalu digeser, dan susunannya tersimpan
 * untuk orang itu sendiri. Lihat susunan-geser.tsx untuk mesinnya.
 *
 * Dua zona, bukan satu: kartu ringkasan bertukar tempat di dalam barisnya
 * sendiri, dan panel besar di dalam kolomnya sendiri. Membiarkan keduanya
 * bercampur berarti satu kartu angka setinggi lima baris dapat mendarat di
 * kolom panel dan meregang setinggi layar - susunan yang dapat dibuat pengguna
 * tetapi tidak pernah diinginkannya.
 */
export function MailDashboardPage() {
  return (
    <PenataDasbor halaman="manajemen-surat">
      <IsiDasborSurat />
    </PenataDasbor>
  );
}

function IsiDasborSurat() {
  const { accessibleLetters, currentUser, dispositions, pendingInbox, positions, activeUsers: users } = usePortal();
  const position = getEffectivePosition(currentUser, positions);
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
      hint: "Surat yang masih perlu Anda cek.",
      href: "/surat?metric=inbox",
    },
    {
      id: "disposisi-terlambat",
      label: "Disposisi Terlambat",
      value: lateDispositionCount,
      hint: `${dueTodayDispositionCount} jatuh tempo hari ini.`,
      href: "/tugas?filter=urgent",
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
        title="Ringkasan Surat"
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
            {/* Hanya muncul setelah dasbornya benar-benar disusun - tombol yang
                mengembalikan sesuatu yang belum pernah diubah tidak menjawab
                pertanyaan siapa pun. */}
            <TombolKembalikanSusunan />
          </>
        }
      />

      <SusunanGeser
        zona="ringkasan"
        sebutan="kartu ringkasan"
        data-testid="mail-dashboard-summary-grid"
        className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 xl:grid-cols-4"
      >
        {stats.map((item) => (
          <ItemGeser key={item.id} kunci={item.id} judul={item.label}>
            <Link href={item.href} className="group block">
            <Card
              data-testid={`mail-summary-card-${item.id}`}
              className="h-full border-border/80 transition duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-panel"
            >
              <CardHeader className="space-y-1 p-3 pb-2 sm:p-4 sm:pb-2">
                <CardDescription className="text-[10px] uppercase tracking-[0.1em] sm:text-[11px] sm:tracking-[0.14em]">{item.label}</CardDescription>
                <CardTitle className="text-2xl sm:text-3xl">{item.value}</CardTitle>
              </CardHeader>
              <CardContent className="flex min-h-8 items-center justify-between gap-2 px-3 pb-3 pt-0 sm:min-h-10 sm:gap-3 sm:px-4 sm:pb-4">
                {item.hint ? (
                  <p className="hidden text-xs leading-5 text-muted-foreground sm:block">{item.hint}</p>
                ) : (
                  <span />
                )}
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-primary" />
              </CardContent>
            </Card>
            </Link>
          </ItemGeser>
        ))}
      </SusunanGeser>

      <SusunanGeser
        zona="panel"
        sebutan="panel"
        data-testid="mail-dashboard-panel-grid"
        className="grid gap-6 xl:grid-cols-[1.14fr_0.86fr]"
      >
        {currentUser?.roleId === "super-admin" ? (
          // Kewenangannya diperiksa DI SINI, bukan lewat susunan tersimpan.
          // Kartu yang tidak digambar tidak akan pernah muncul walau kuncinya
          // masih tercatat pada urutan lama seseorang.
          <ItemGeser kunci="whatsapp" judul="Kendali WhatsApp" className="hidden sm:block xl:col-span-2">
            <WhatsAppControl />
          </ItemGeser>
        ) : null}

        <ItemGeser kunci="tugas-penting" judul="Tugas Penting" className="hidden md:block">
        <Card className="h-full border-border/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary" />
              Tugas Penting
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {taskWidget.length === 0 ? (
              <SectionHint
                icon="inbox"
                title="Tidak ada tugas mendesak"
                description="Tidak ada surat yang perlu segera ditindaklanjuti."
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
        </ItemGeser>

        <ItemGeser kunci="aktivitas-terbaru" judul="Aktivitas Terbaru">
        <Card className="h-full border-border/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellRing className="h-5 w-5 text-primary" />
              Aktivitas Terbaru
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentActivities.length === 0 ? (
              <SectionHint
                icon="inbox"
                title="Belum ada aktivitas"
                description="Aktivitas disposisi akan muncul ketika surat mulai diteruskan atau ditindaklanjuti."
                href="/surat"
              />
            ) : (
              recentActivities.map((item) => {
                const sender = getUser(item.pengirimId, users);
                const recipient = getUser(item.penerimaId, users);
                const positionLabel = getPosition(item.targetPositionId, positions)?.name ?? "-";

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
        </ItemGeser>
      </SusunanGeser>
    </div>
  );
}
