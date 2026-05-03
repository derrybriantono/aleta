"use client";

import { cn } from "@/lib/utils";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
  BellRing,
  CheckCircle2,
  Circle,
  FileCheck2,
  GitBranchPlus,
  History,
  RotateCcw,
  SendHorizontal,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";

import { AletaMailInsights } from "@/components/portal/aleta-mail-insights";
import { EmptyState, PageIntro, statusVariant } from "@/components/portal/shared";
import { WhatsAppStatusStack } from "@/components/portal/whatsapp-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { usePortal } from "@/lib/app-state";
import { type UserPersona } from "@/lib/types";
import {
  getDispositionDeadlineLabel,
  getDispositionDeadlineState,
  getDispositionReadLabel,
} from "@/lib/disposition-status";
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

const workflowLabels = {
  draft: "Draft",
  submitted: "Diajukan",
  approved: "Disetujui",
  sent: "Dikirim/Terbit",
  rejected: "Ditolak",
} as const;

type WorkflowUiAction = "submit" | "approve" | "reject" | "mark-sent" | "return-draft";

const workflowActionCopy: Record<WorkflowUiAction, { title: string; description: string; cta: string }> = {
  submit: {
    title: "Ajukan Review Surat Keluar",
    description: "Surat keluar ini akan dikirim ke pejabat berwenang untuk ditinjau dan disetujui.",
    cta: "Ajukan Review",
  },
  approve: {
    title: "Setujui Surat Keluar",
    description: "Surat ini akan berubah menjadi Disetujui dan dapat ditandai terbit/dikirim oleh petugas berwenang.",
    cta: "Setujui",
  },
  reject: {
    title: "Tolak Surat Keluar",
    description: "Surat akan dikembalikan untuk diperbaiki. Catatan penolakan wajib diisi.",
    cta: "Tolak Surat",
  },
  "mark-sent": {
    title: "Tandai Terbit/Dikirim",
    description: "Surat ini akan ditandai sebagai terbit/dikirim. Pastikan dokumen resmi sudah benar.",
    cta: "Tandai Terbit/Dikirim",
  },
  "return-draft": {
    title: "Kembalikan ke Draft",
    description: "Status surat akan dikembalikan ke Draft untuk diperbaiki sebelum diajukan kembali.",
    cta: "Kembalikan ke Draft",
  },
};

function workflowBadgeVariant(status: keyof typeof workflowLabels): "success" | "warning" | "danger" | "outline" {
  if (status === "sent" || status === "approved") return "success";
  if (status === "submitted") return "warning";
  if (status === "rejected") return "danger";
  return "outline";
}

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
    transitionLetterWorkflow,
    users,
  } = usePortal();
  const [forwardFeedback, setForwardFeedback] = useState("");
  const [workflowFeedback, setWorkflowFeedback] = useState("");
  const [isWorkflowSaving, setIsWorkflowSaving] = useState(false);
  const [workflowModal, setWorkflowModal] = useState<WorkflowUiAction | null>(null);
  const [workflowRejectionNote, setWorkflowRejectionNote] = useState("");
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
  const activeDispositionCount = timeline.filter((item) => item.status !== "Selesai").length;
  const whatsappDeliveries = [
    ...letter.whatsappDeliveries.map((delivery) => ({ ...delivery, sourceFeature: "Surat" })),
    ...timeline.flatMap((item) =>
      (item.whatsappDeliveries ?? []).map((delivery) => ({
        ...delivery,
        sourceFeature: `Disposisi ${item.id}`,
      }))
    ),
  ];
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
  const workflowStatus = letter.workflowStatus ?? (letter.type === "keluar" ? "draft" : "sent");
  const currentRoleId = currentUser?.roleId;
  const isCreator = Boolean(currentUser?.id && letter.createdByUserId === currentUser.id);
  const canSubmitWorkflow = isAdmin || isCreator;
  const canApproveWorkflow =
    isAdmin ||
    ["ketua", "wakil-ketua", "sekretaris", "panitera"].includes(currentRoleId ?? "");
  const canMarkSentWorkflow = isAdmin || isCreator || currentRoleId === "sekretaris";

  const openWorkflowModal = (action: WorkflowUiAction) => {
    setWorkflowFeedback("");
    setWorkflowRejectionNote(action === "reject" ? letter.rejectionNote ?? "" : "");
    setWorkflowModal(action);
  };

  const runWorkflowAction = async (action: WorkflowUiAction) => {
    let rejectionNote: string | null = null;
    if (action === "reject") {
      rejectionNote = workflowRejectionNote.trim();
      if (!rejectionNote) {
        setWorkflowFeedback("Catatan penolakan wajib diisi agar pembuat surat memahami perbaikannya.");
        return;
      }
    }

    setIsWorkflowSaving(true);
    setWorkflowFeedback("");
    const result = await transitionLetterWorkflow(letter.id, { action, rejectionNote });
    setIsWorkflowSaving(false);
    setWorkflowFeedback(result.message);
    setWorkflowModal(null);
  };

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
                  if (deleteMode === "hard" && activeDispositionCount > 0) {
                    window.alert(
                      `Surat ini masih memiliki ${activeDispositionCount} disposisi aktif. Selesaikan disposisi terlebih dahulu sebelum menghapus permanen.`
                    );
                    return;
                  }

                  const confirmed = window.confirm(
                    activeDispositionCount > 0
                      ? `Surat ini masih memiliki ${activeDispositionCount} disposisi aktif. Menghapus surat dapat mengganggu tindak lanjut. Gunakan arsip/nonaktifkan hanya jika sudah yakin. Lanjutkan?`
                      : deleteMode === "hard"
                        ? "Surat akan dihapus permanen. Tindakan ini tidak dapat dibatalkan. Lanjutkan?"
                        : "Arsipkan surat ini dari daftar aktif? Lanjutkan?"
                  );

                  if (!confirmed) return;
                  deleteLetter(letter.id);
                  router.push("/surat");
                }}
              >
                <Trash2 className="h-4 w-4" />
                {deleteMode === "hard" ? "Hapus Permanen" : "Arsipkan"}
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

      {workflowFeedback ? (
        <div className="rounded-[1.35rem] border border-sky-300/60 bg-sky-500/10 px-4 py-3 text-sm text-sky-800 dark:text-sky-200">
          {workflowFeedback}
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
                      <span>Disposisi aktif</span>
                      <strong className="text-foreground">{currentDisposition?.id ?? "-"}</strong>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between gap-3">
                    <span>Mode dokumen</span>
                    <strong className="text-foreground">{letter.viewerMode === "preview" ? "Preview" : "Download"}</strong>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Notifikasi pimpinan</span>
                    <strong className="text-foreground">{activeLeadershipNotifications.length}</strong>
                  </div>
                </div>
              </div>

              {letter.type === "keluar" ? (
                <div className="rounded-[1.2rem] border border-border bg-card/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Alur Surat Keluar</p>
                    <Badge variant={workflowBadgeVariant(workflowStatus)}>
                      {workflowLabels[workflowStatus] ?? workflowStatus}
                    </Badge>
                  </div>
                  <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                    <WorkflowMetaRow label="Diajukan" at={letter.submittedAt} userId={letter.submittedByUserId} users={users} />
                    <WorkflowMetaRow label="Disetujui" at={letter.approvedAt} userId={letter.approvedByUserId} users={users} />
                    <WorkflowMetaRow label="Dikirim/Terbit" at={letter.sentAt} userId={letter.sentByUserId} users={users} />
                    {letter.rejectionNote ? (
                      <div className="rounded-xl border border-rose-300/50 bg-rose-500/10 p-3 text-rose-800 dark:text-rose-200">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em]">Catatan Penolakan</p>
                        <p className="mt-1 leading-6">{letter.rejectionNote}</p>
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {["draft", "rejected"].includes(workflowStatus) && canSubmitWorkflow ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={isWorkflowSaving}
                        onClick={() => openWorkflowModal("submit")}
                      >
                        <SendHorizontal className="h-4 w-4" />
                        Ajukan Pemeriksaan
                      </Button>
                    ) : null}
                    {workflowStatus === "submitted" && canApproveWorkflow ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          disabled={isWorkflowSaving}
                          onClick={() => openWorkflowModal("approve")}
                        >
                          <FileCheck2 className="h-4 w-4" />
                          Setujui
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isWorkflowSaving}
                          onClick={() => openWorkflowModal("reject")}
                        >
                          <XCircle className="h-4 w-4" />
                          Tolak
                        </Button>
                      </>
                    ) : null}
                    {workflowStatus === "approved" && canMarkSentWorkflow ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={isWorkflowSaving}
                        onClick={() => openWorkflowModal("mark-sent")}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Tandai Terbit/Dikirim
                      </Button>
                    ) : null}
                    {["submitted", "rejected"].includes(workflowStatus) && canSubmitWorkflow ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isWorkflowSaving}
                        onClick={() => openWorkflowModal("return-draft")}
                      >
                        <RotateCcw className="h-4 w-4" />
                        Kembali ke Draft
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}

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
                    showFullNumber={isAdmin}
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
                    <span className="font-semibold">Hapus Permanen</span>
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
            <BellRing className="h-4 w-4 text-primary" />
            Notifikasi WhatsApp
          </CardTitle>
          <CardDescription>
            Riwayat pengiriman WhatsApp yang terkait dengan surat dan disposisi ini.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.1rem] border border-border bg-muted/35 p-3 text-sm text-muted-foreground">
            <span>Lihat konteks pengiriman lengkap di modul ALETA Bot bila perlu audit lebih lanjut.</span>
            <Button asChild variant="outline" size="sm">
              <Link href={`/aleta-bot?tab=riwayat-pengiriman&sourceFeature=disposition&entityId=${encodeURIComponent(letter.id)}`}>
                Lihat di Riwayat ALETA Bot
              </Link>
            </Button>
          </div>
          <WhatsAppStatusStack
            deliveries={whatsappDeliveries}
            showFullNumber={isAdmin}
            onRetry={(deliveryId) => {
              const letterDelivery = letter.whatsappDeliveries.find((delivery) => delivery.id === deliveryId);
              if (letterDelivery) {
                void retryWhatsappDelivery({ scope: "letter", entityId: letter.id, deliveryId });
                return;
              }
              const disposition = timeline.find((item) =>
                (item.whatsappDeliveries ?? []).some((delivery) => delivery.id === deliveryId)
              );
              if (disposition) {
                void retryWhatsappDelivery({ scope: "disposition", entityId: disposition.id, deliveryId });
              }
            }}
          />
        </CardContent>
      </Card>

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
                const deadlineState = getDispositionDeadlineState(item);
                
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
                          {!item.readAt && item.status !== "Selesai" ? (
                            <Badge variant="warning">Belum Dibaca</Badge>
                          ) : null}
                          {deadlineState === "overdue" ? (
                            <Badge variant="danger">Terlambat</Badge>
                          ) : deadlineState === "due_today" ? (
            <Badge variant="warning">Tenggat Hari Ini</Badge>
                          ) : item.deadlineAt ? (
                            <Badge variant="outline">{getDispositionDeadlineLabel(item)}</Badge>
                          ) : null}
                          <Badge variant={statusVariant(item.status)} className="shadow-sm">{item.status}</Badge>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border/60 bg-muted/40 p-4 transition-colors hover:bg-muted/60">
                        <p className="text-sm leading-7 text-muted-foreground">
                          {item.instruksi || "Tidak ada instruksi khusus."}
                        </p>
                        <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                          <span>{getDispositionDeadlineLabel(item)}</span>
                          <span>{getDispositionReadLabel(item)}</span>
                        </div>
                        
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

      {workflowModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[1.35rem] border border-border bg-card p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Workflow Surat Keluar</p>
                <h2 className="mt-2 text-xl font-semibold text-foreground">{workflowActionCopy[workflowModal].title}</h2>
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={() => setWorkflowModal(null)} disabled={isWorkflowSaving}>
                Tutup
              </Button>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">{workflowActionCopy[workflowModal].description}</p>
            {workflowModal === "reject" ? (
              <label className="mt-4 block space-y-2">
                <span className="text-sm font-semibold text-foreground">Catatan penolakan</span>
                <Textarea
                  value={workflowRejectionNote}
                  onChange={(event) => setWorkflowRejectionNote(event.target.value)}
                  rows={4}
                  placeholder="Jelaskan bagian yang perlu diperbaiki sebelum surat diajukan kembali."
                />
              </label>
            ) : null}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setWorkflowModal(null)} disabled={isWorkflowSaving}>
                Batal
              </Button>
              <Button
                type="button"
                variant={workflowModal === "reject" ? "destructive" : "default"}
                onClick={() => void runWorkflowAction(workflowModal)}
                disabled={isWorkflowSaving}
              >
                {workflowActionCopy[workflowModal].cta}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
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

function WorkflowMetaRow({
  label,
  at,
  userId,
  users,
}: {
  label: string;
  at?: string | null;
  userId?: string | null;
  users: UserPersona[];
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span>{label}</span>
      <strong className="text-right text-foreground">
        {at ? `${formatDateTime(at)}${userId ? ` oleh ${getUser(userId, users)?.name ?? userId}` : ""}` : "-"}
      </strong>
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
