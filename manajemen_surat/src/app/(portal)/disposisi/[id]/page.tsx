"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { MessageCircleMore } from "lucide-react";

import { DispositionWorkbench } from "@/components/portal/disposition-workbench";
import { EmptyState, PageIntro } from "@/components/portal/shared";
import { WhatsAppStatusStack } from "@/components/portal/whatsapp-status";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePortal } from "@/lib/app-state";
import { getEffectivePositionId, isPrivilegedAdmin } from "@/lib/permissions";

const LazyDocumentViewer = dynamic(
  () => import("@/components/portal/document-viewer").then((module) => module.DocumentViewer),
  {
    ssr: false,
  }
);

export default function DisposisiDetailPage() {
  const params = useParams<{ id: string }>();
  const { currentUser, getDispositionById, getLetterById, markDispositionRead, retryWhatsappDelivery } = usePortal();
  const disposition = getDispositionById(params.id);
  const letter = disposition ? getLetterById(disposition.suratId) : null;
  const dispositionId = disposition?.id;
  const shouldMarkRead = Boolean(
    disposition &&
      currentUser &&
      !disposition.readAt &&
      (disposition.penerimaId === currentUser.id ||
        disposition.targetPositionId === getEffectivePositionId(currentUser))
  );

  useEffect(() => {
    if (!dispositionId || !shouldMarkRead) return;
    void markDispositionRead(dispositionId);
  }, [dispositionId, markDispositionRead, shouldMarkRead]);

  if (!disposition || !letter) {
    return (
      <EmptyState
        title="Disposisi tidak ditemukan"
        description="Node disposisi ini mungkin belum ada untuk akun aktif atau ID yang dibuka tidak valid."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Workbench"
        title="Disposisi digital berjenjang"
        description="Viewer surat ditempatkan berdampingan dengan panel pengisian disposisi agar instruksi dapat ditulis sambil tetap merujuk isi dokumen."
      />

      <div className="grid gap-6 2xl:items-start 2xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.84fr)]">
        <div className="space-y-6 2xl:sticky 2xl:top-4">
          <Card className="overflow-hidden border-border/80">
            <LazyDocumentViewer letter={letter} currentUser={currentUser} />
          </Card>

          <Card className="border-border/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircleMore className="h-4 w-4 text-primary" />
                Status WhatsApp
              </CardTitle>
              <CardDescription>Riwayat notifikasi WA untuk node disposisi ini, lengkap dengan retry bila pengiriman gagal.</CardDescription>
            </CardHeader>
            <CardContent>
              <WhatsAppStatusStack
                deliveries={disposition.whatsappDeliveries ?? []}
                showFullNumber={isPrivilegedAdmin(currentUser)}
                onRetry={(deliveryId) =>
                  retryWhatsappDelivery({ scope: "disposition", entityId: disposition.id, deliveryId })
                }
              />
            </CardContent>
          </Card>
        </div>

        <div className="2xl:sticky 2xl:top-4 2xl:max-h-[calc(100vh-5rem)] 2xl:overflow-y-auto 2xl:rounded-[1.4rem]">
          <DispositionWorkbench letter={letter} disposition={disposition} />
        </div>
      </div>
    </div>
  );
}
