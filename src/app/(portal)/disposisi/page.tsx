"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Send, Zap } from "lucide-react";

import { EmptyState, PageIntro, statusVariant } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { usePortal } from "@/lib/app-state";
import { formatDateTime } from "@/lib/format";
import {
  canUserAccessDispositionAction,
  getAllowedDispositionTargetPositions,
  getPosition,
  getUserPositionLabel,
} from "@/lib/permissions";

export default function DisposisiLandingPage() {
  const { pendingInbox, accessibleLetters, currentUser, createDisposition, getUsersByPosition } = usePortal();
  const [quickOpenId, setQuickOpenId] = useState<string | null>(null);
  const [targetPositionId, setTargetPositionId] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [instruction, setInstruction] = useState("");
  const [feedback, setFeedback] = useState("");
  const queue = useMemo(() => {
    const seen = new Set<string>();

    return pendingInbox.filter((item) => {
      if (seen.has(item.suratId)) return false;
      seen.add(item.suratId);
      return true;
    });
  }, [pendingInbox]);
  const targetPositions = getAllowedDispositionTargetPositions(currentUser, { bypass: false });
  const selectedTargetPositionId = targetPositions.some((position) => position.id === targetPositionId)
    ? targetPositionId
    : targetPositions[0]?.id ?? "";
  const availableUsers = selectedTargetPositionId ? getUsersByPosition(selectedTargetPositionId) : [];
  const selectedRecipientId = availableUsers.some((user) => user.id === recipientId)
    ? recipientId
    : availableUsers[0]?.id ?? "";
  const canQuickAction = canUserAccessDispositionAction(currentUser);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Antrean Disposisi"
        title="Pilih surat yang akan didisposisikan"
        description="Halaman awal ini menampilkan antrean surat yang perlu ditindaklanjuti. Pilih surat terlebih dahulu untuk membuka panel berjenjang, atau gunakan Disposisi Cepat untuk instruksi singkat langsung dari antrean."
      />

      {feedback ? (
        <div className="rounded-[1.2rem] border border-emerald-300/60 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
          {feedback}
        </div>
      ) : null}

      {queue.length === 0 ? (
        <EmptyState
          title="Antrean disposisi kosong"
          description="Belum ada surat yang menunggu disposisi untuk akun aktif saat ini."
        />
      ) : (
        <div className="grid gap-4">
          {queue.map((item) => {
            const letter = accessibleLetters.find((entry) => entry.id === item.suratId);
            if (!letter) return null;

            return (
              <Card key={item.id} className="border-border/80">
                <CardContent className="space-y-4 p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                        <Badge variant="outline">{letter.type === "masuk" ? "Surat Masuk" : "Surat Keluar"}</Badge>
                        <Badge variant="outline">{letter.assignedUnit}</Badge>
                      </div>
                      <div>
                        <h2 className="font-serif text-2xl text-foreground">{letter.perihal}</h2>
                        <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.instruksi}</p>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span>{letter.nomorSurat}</span>
                        <span>{formatDateTime(item.createdAt)}</span>
                        <span>{getPosition(item.targetPositionId)?.name}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button asChild>
                        <Link href={`/disposisi/${item.id}`}>
                          Buka Panel
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                      {canQuickAction ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setQuickOpenId(quickOpenId === item.id ? null : item.id);
                            setTargetPositionId(targetPositions[0]?.id ?? "");
                            setRecipientId("");
                            setInstruction("");
                            setFeedback("");
                          }}
                        >
                          <Zap className="h-4 w-4" />
                          Disposisi Cepat
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {quickOpenId === item.id && canQuickAction ? (
                    <div className="rounded-[1.3rem] border border-border bg-muted/35 p-4">
                      <div className="grid gap-4 lg:grid-cols-[220px_240px_minmax(0,1fr)_auto] lg:items-end">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground">Jabatan tujuan</label>
                          <NativeSelect value={selectedTargetPositionId} onChange={(event) => setTargetPositionId(event.target.value)}>
                            {targetPositions.map((position) => (
                              <option key={position.id} value={position.id}>
                                {position.name}
                              </option>
                            ))}
                          </NativeSelect>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground">Individu tujuan</label>
                          <NativeSelect value={selectedRecipientId} onChange={(event) => setRecipientId(event.target.value)}>
                            {availableUsers.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.name} - {getUserPositionLabel(user)}
                              </option>
                            ))}
                          </NativeSelect>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground">Instruksi singkat</label>
                          <Textarea
                            value={instruction}
                            onChange={(event) => setInstruction(event.target.value)}
                            placeholder="Tuliskan arahan singkat untuk disposisi cepat."
                          />
                        </div>
                        <Button
                          type="button"
                          disabled={!selectedRecipientId || !selectedTargetPositionId || !instruction.trim()}
                          onClick={() => {
                            createDisposition({
                              suratId: letter.id,
                              parentDispositionId: item.id,
                              penerimaId: selectedRecipientId,
                              targetPositionId: selectedTargetPositionId,
                              instruksi: instruction.trim(),
                              allowDownload: item.allowDownload,
                              urgent: true,
                              bypass: false,
                              routingType: "standard",
                            });
                            setFeedback("Disposisi cepat berhasil dikirim dari antrean.");
                            setQuickOpenId(null);
                            setInstruction("");
                          }}
                        >
                          <Send className="h-4 w-4" />
                          Kirim
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
