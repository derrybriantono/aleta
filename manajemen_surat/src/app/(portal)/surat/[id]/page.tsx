"use client";

import { cn } from "@/lib/utils";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { BellRing, CheckCircle2, Circle, GitBranchPlus, History, ShieldCheck, Trash2 } from "lucide-react";

import { AletaMailInsights } from "@/components/portal/aleta-mail-insights";
import { EmptyState, PageIntro, statusVariant } from "@/components/portal/shared";
import { WhatsAppStatusStack } from "@/components/portal/whatsapp-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePortal } from "@/lib/app-state";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  canUserAccessDispositionAction,
  canUserForwardToLeadership,
  getLeadershipRecipients,
  getPosition,
  getUser,
  isPrivilegedAdmin,
} from "@/lib/permissions";

const LazyDocumentViewer = dynamic(
  () => import("@/components/portal/document-viewer").then((module) => module.DocumentViewer),
  {
    ssr: false,
    loading: () => <ViewerFallback />,
  }
);

export default function SuratDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const {
    currentUser,
    deleteLetter,
    forwardToLeadership,
    getLetterById,
    getLetterDispositionsById,
    retryWhatsappDelivery,
    users,
  } = usePortal();
  const [forwardFeedback, setForwardFeedback] = useState("");
  const letter = getLetterById(params.id);
  const deleteMode =
    currentUser?.roleId === "super-admin" ? "hard" : currentUser?.roleId === "admin" ? "soft" : null;
  const isAdmin = isPrivilegedAdmin(currentUser);

  if (!letter) {
    return (
      <EmptyState
        title="Surat tidak ditemukan"
        description="Periksa kembali ID surat atau akun aktif yang mungkin tidak memiliki akses ke data ini."
      />
    );
  }

  const timeline = getLetterDispositionsById(letter.id);
  const currentDisposition = timeline[timeline.length - 1];
  const canOpenDisposition = Boolean(currentDisposition) && canUserAccessDispositionAction(currentUser);
  const leadershipRecipients = getLeadershipRecipients(users).filter((recipient) => recipient.id !== currentUser?.id);
  const activeLeadershipNotifications = timeline.filter(
    (item) => item.routingType === "leadership-notification" && item.status !== "Selesai"
  );
  const notifiedLeadershipIds = new Set(activeLeadershipNotifications.map((item) => item.penerimaId));
  const remainingLeadershipRecipients = leadershipRecipients.filter(
    (recipient) => !notifiedLeadershipIds.has(recipient.id)
  );
  const canForwardLeadership =
    letter.type === "masuk" && canUserForwardToLeadership(currentUser) && remainingLeadershipRecipients.length > 0;

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Detail Surat"
        title={letter.perihal}
        description={`${letter.type === "masuk" ? "Surat masuk" : "Surat keluar"} dari ${letter.pengirim}`}
        actions={
          <>
            {canOpenDisposition ? (
              <Button asChild>
                <Link href={`/disposisi/${currentDisposition?.id}`}>
                  <GitBranchPlus className="h-4 w-4" />
                  Disposisi
                </Link>
              </Button>
            ) : null}
            {canUserForwardToLeadership(currentUser) && letter.type === "masuk" ? (
              <Button
                variant="outline"
                disabled={!canForwardLeadership}
                onClick={() => {
                  if (!canForwardLeadership) {
                    setForwardFeedback("Notifikasi pimpinan untuk surat ini sudah aktif pada akun Ketua/Wakil.");
                    return;
                  }

                  forwardToLeadership({ suratId: letter.id });
                  setForwardFeedback(
                    `Notifikasi real-time telah dikirim ke ${remainingLeadershipRecipients
                      .map((recipient) => recipient.name)
                      .join(", ")}.`
                  );
                }}
              >
                <BellRing className="h-4 w-4" />
                Teruskan ke Pimpinan
              </Button>
            ) : null}
            {deleteMode ? (
              <Button
                variant="destructive"
                onClick={() => {
                  const confirmed = window.confirm(
                    deleteMode === "hard"
                      ? "Hard delete akan menghapus surat secara permanen. Lanjutkan?"
                      : "Hapus surat ini dari daftar aktif? Lanjutkan?"
                  );

                  if (!confirmed) return;
                  deleteLetter(letter.id);
                  router.push("/surat");
                }}
              >
                <Trash2 className="h-4 w-4" />
                {deleteMode === "hard" ? "Hard Delete" : "Delete"}
              </Button>
            ) : null}
          </>
        }
      />

      {forwardFeedback ? (
        <div className="rounded-[1.35rem] border border-sky-300/60 bg-sky-500/10 px-4 py-3 text-sm text-sky-800 dark:text-sky-200">
          {forwardFeedback}
        </div>
      ) : null}

      <Card className="overflow-hidden border-border/80">
        <div className="grid items-stretch xl:grid-cols-[430px_minmax(0,1fr)]">
          <aside className="border-b border-border bg-muted/30 xl:border-b-0 xl:border-r">
            <div className="space-y-5 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Metadata Surat</p>
                  <h2 className="mt-2 font-serif text-2xl text-foreground">{letter.nomorSurat}</h2>
                </div>
                <Badge variant={statusVariant(letter.status)}>{letter.status}</Badge>
              </div>

              <div className="grid gap-4">
                <DetailRow label="Nomor urut" value={letter.nomorUrut ?? "-"} />
                <DetailRow label="Tipe" value={letter.type === "masuk" ? "Surat Masuk" : "Surat Keluar"} />
                <DetailRow label="Tanggal surat" value={formatDate(letter.tanggal)} />
                <DetailRow
                  label={letter.type === "masuk" ? "Tanggal terima" : "Tanggal kirim"}
                  value={formatDate(letter.tanggalAdministratif ?? letter.tanggal)}
                />
                <DetailRow label="Pengirim" value={letter.pengirim} />
                <DetailRow label="Asal surat" value={letter.asalSurat} />
                <DetailRow label="Tujuan surat" value={letter.tujuanSurat} />
                <DetailRow label="Unit terkait" value={letter.assignedUnit} />
                <DetailRow label="Pengunggah" value={letter.createdByUserName || "-"} />
                <DetailRow label="Klasifikasi" value={letter.klasifikasi} />
                <DetailRow label="Kode klasifikasi" value={letter.kodeKlasifikasi ?? "-"} />
                <DetailRow label="Kerahasiaan" value={letter.confidentiality} />
                <DetailRow label="Ringkasan" value={letter.ringkasan} />
              </div>

              <div className="rounded-[1.2rem] border border-border bg-card/70 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Kendali cepat</p>
                <div className="mt-3 space-y-3 text-sm text-muted-foreground">
                  {isAdmin ? (
                    <div className="flex items-center justify-between gap-3">
                      <span>Node aktif</span>
                      <strong className="text-foreground">{currentDisposition?.id ?? "-"}</strong>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between gap-3">
                    <span>Mode viewer</span>
                    <strong className="text-foreground">{letter.viewerMode === "preview" ? "Preview" : "Download"}</strong>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Notifikasi pimpinan</span>
                    <strong className="text-foreground">{activeLeadershipNotifications.length}</strong>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Lampiran</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {letter.lampiran.map((item) => (
                    <Badge key={item} variant="outline">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.2rem] border border-border bg-card/70 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Status WhatsApp</p>
                <div className="mt-3">
                  <WhatsAppStatusStack
                    deliveries={letter.whatsappDeliveries}
                    onRetry={(deliveryId) =>
                      void retryWhatsappDelivery({ scope: "letter", entityId: letter.id, deliveryId })
                    }
                  />
                </div>
              </div>

              {activeLeadershipNotifications.length > 0 ? (
                <div className="rounded-[1.2rem] border border-sky-400/30 bg-sky-500/10 p-4 text-sm leading-7 text-sky-800 dark:text-sky-200">
                  Surat ini sudah diteruskan ke{" "}
                  <strong>
                    {activeLeadershipNotifications
                      .map(
                        (item) =>
                          getUser(item.penerimaId, users)?.name ??
                          getPosition(item.targetPositionId)?.name ??
                          item.penerimaId
                      )
                      .join(", ")}
                  </strong>
                  .
                </div>
              ) : null}

              {deleteMode === "hard" ? (
                <div className="rounded-[1.2rem] border border-rose-300/60 bg-rose-50 p-4 text-sm dark:border-rose-700/40 dark:bg-rose-950/30">
                  <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
                    <Trash2 className="h-4 w-4" />
                    <span className="font-semibold">Hard Delete</span>
                  </div>
                  <p className="mt-1.5 leading-6 text-rose-800 dark:text-rose-200">
                    Akun Super Admin dapat menghapus surat ini secara permanen. Tindakan ini tidak dapat dibatalkan.
                  </p>
                </div>
              ) : null}
            </div>
          </aside>

          <div className="min-w-0">
            <LazyDocumentViewer letter={letter} currentUser={currentUser} />
          </div>
        </div>
      </Card>

      <AletaMailInsights letter={letter} timeline={timeline} />

      <Card className="border-border/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Riwayat Disposisi
          </CardTitle>
          <CardDescription>Alur parent-child surat ini, termasuk notifikasi pimpinan dan tindak lanjut terakhir.</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:h-full before:w-0.5 before:-translate-x-px before:bg-gradient-to-b before:from-primary/50 before:via-border before:to-transparent">
            {timeline.length > 0 ? (
              timeline.map((item, index) => {
                const isLast = index === timeline.length - 1;
                const isFirst = index === 0;
                
                return (
                  <div key={item.id} className="relative flex items-start gap-6 pl-2">
                    <div className={cn(
                      "relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-4 border-background transition-all duration-300",
                      item.status === "Selesai" ? "bg-emerald-500 text-white" : "bg-primary text-white",
                      isLast && item.status !== "Selesai" ? "ring-4 ring-primary/20 animate-pulse" : ""
                    )}>
                      {item.status === "Selesai" ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <Circle className="h-1.5 w-1.5 fill-current" />
                      )}
                    </div>

                    <div className="flex-1 space-y-3 pb-2">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-1">
                          <p className="font-semibold text-foreground">
                            {getUser(item.pengirimId, users)?.name} <span className="mx-1 text-muted-foreground font-normal">ke</span> {getUser(item.penerimaId, users)?.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {getPosition(item.targetPositionId)?.name} • {formatDateTime(item.createdAt)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {item.routingType === "leadership-notification" ? (
                            <Badge variant="outline" className="bg-sky-500/5 text-sky-600 dark:text-sky-300 border-sky-200/50">Notifikasi Pimpinan</Badge>
                          ) : null}
                          <Badge variant={statusVariant(item.status)} className="shadow-sm">{item.status}</Badge>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border/60 bg-muted/40 p-4 transition-colors hover:bg-muted/60">
                        <p className="text-sm leading-7 text-muted-foreground">
                          {item.instruksi || "Tidak ada instruksi khusus."}
                        </p>
                        
                        {item.followUpNote && (
                          <div className="mt-4 flex gap-3 rounded-xl border border-primary/10 bg-primary/5 p-3">
                            <History className="h-4 w-4 shrink-0 text-primary" />
                            <div className="space-y-1">
                              <p className="text-[12px] font-bold text-primary uppercase tracking-wider">Tindak Lanjut</p>
                              <p className="text-sm text-muted-foreground">{item.followUpNote}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="rounded-full bg-muted p-4 text-muted-foreground">
                  <History className="h-8 w-8" />
                </div>
                <p className="mt-4 text-lg font-medium text-foreground">Belum ada riwayat</p>
                <p className="text-sm text-muted-foreground">Surat ini belum memiliki catatan disposisi atau pergerakan.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm leading-7 text-foreground">{value}</p>
    </div>
  );
}

function ViewerFallback() {
  return (
    <div className="flex h-full min-h-[620px] flex-col">
      <div className="border-b border-border/80 px-5 py-5 sm:px-6">
        <div className="h-6 w-52 rounded-full bg-muted/70" />
        <div className="mt-3 h-4 w-full max-w-2xl rounded-full bg-muted/60" />
      </div>
      <div className="flex-1 p-4">
        <div className="h-full min-h-[520px] rounded-[1.6rem] border border-border bg-muted/35" />
      </div>
    </div>
  );
}
