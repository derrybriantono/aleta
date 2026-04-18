"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Clock3, Paperclip, Send, ShieldCheck, Sparkles, Users2 } from "lucide-react";

import { AletaAIMark } from "@/components/branding/aleta-ai-mark";
import { statusVariant } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { usePortal } from "@/lib/app-state";
import { formatDateTime } from "@/lib/format";
import {
  getAllowedDispositionTargetPositions,
  getEffectivePosition,
  getPosition,
  getUser,
  getUserPositionLabel,
  isDispositionAssignedToUser,
} from "@/lib/permissions";
import { type DispositionNode, type LetterDetail, type Position } from "@/lib/types";
import { cn } from "@/lib/utils";

type ComposerProps = {
  letter: LetterDetail;
  disposition: DispositionNode;
};

export function DispositionWorkbench({ letter, disposition }: ComposerProps) {
  const router = useRouter();
  const { aiConfig, currentUser, createDisposition, completeDisposition, dispositions, getUsersByPosition, users } = usePortal();
  const [targetPositionId, setTargetPositionId] = useState("");
  const [penerimaId, setPenerimaId] = useState("");
  const [instruksi, setInstruksi] = useState("");
  const [allowDownload, setAllowDownload] = useState(disposition.allowDownload);
  const [urgent, setUrgent] = useState(false);
  const [bypass, setBypass] = useState(false);
  const [note, setNote] = useState("");
  const [fileName, setFileName] = useState("laporan-tindak-lanjut.pdf");
  const [isGeneratingAiAssist, setIsGeneratingAiAssist] = useState(false);
  const [aiAssist, setAiAssist] = useState<{
    summary: string;
    suggestedInstruction: string;
    suggestedTargetLabel: string;
  } | null>(null);
  const [aiAssistError, setAiAssistError] = useState("");

  const currentPosition = getEffectivePosition(currentUser);
  const recipient = getUser(disposition.penerimaId, users);
  const childCount = dispositions.filter((item) => item.parentDispositionId === disposition.id).length;
  const canForward = isDispositionAssignedToUser(currentUser, disposition);
  const isFinalRecipient = canForward && childCount === 0;
  const targetPositions = useMemo(
    () => getAllowedDispositionTargetPositions(currentUser, { bypass }),
    [bypass, currentUser]
  );
  const selectedTargetPositionId = targetPositions.some((position) => position.id === targetPositionId)
    ? targetPositionId
    : targetPositions[0]?.id ?? "";
  const availableUsers = useMemo(
    () => (selectedTargetPositionId ? getUsersByPosition(selectedTargetPositionId) : []),
    [getUsersByPosition, selectedTargetPositionId]
  );
  const selectedRecipientId = availableUsers.some((user) => user.id === penerimaId)
    ? penerimaId
    : availableUsers[0]?.id ?? "";
  const targetPositionOptions = useMemo(
    () =>
      targetPositions.map((position) => ({
        id: position.id,
        label: `${position.name} - ${position.unitKerja}`,
      })),
    [targetPositions]
  );
  const timeline = useMemo(
    () =>
      dispositions
        .filter((item) => item.suratId === letter.id)
        .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()),
    [dispositions, letter.id]
  );

  useEffect(() => {
    if (!aiConfig.enabled) {
      setAiAssist(null);
      setIsGeneratingAiAssist(false);
      setAiAssistError("");
    }
  }, [aiConfig.enabled]);

  return (
    <div className="space-y-6">
      <Card className="border-border/80">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Ringkasan Disposisi</CardTitle>
              <CardDescription>Node aktif yang sedang diproses pada surat ini.</CardDescription>
            </div>
            <Badge variant={statusVariant(disposition.status)}>{disposition.status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Info label="Pengirim" value={getUser(disposition.pengirimId, users)?.name ?? "-"} />
          <Info label="Penerima" value={recipient?.name ?? "-"} />
          <Info label="Jabatan tujuan" value={getPosition(disposition.targetPositionId)?.name ?? "-"} />
          <Info label="Dibuat" value={formatDateTime(disposition.createdAt)} />
          <Info label="Instruksi" value={disposition.instruksi} className="md:col-span-2" />
        </CardContent>
      </Card>

      <Card className="border-border/80">
        <CardHeader>
          <CardTitle>Timeline Rantai Disposisi</CardTitle>
          <CardDescription>Menampilkan parent-child flow beserta status tindak lanjut.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {timeline.map((item, index) => (
            <div key={item.id} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {index + 1}
                </div>
                {index < timeline.length - 1 ? <div className="mt-2 h-full w-px bg-border" /> : null}
              </div>
              <div className="flex-1 rounded-2xl border border-border bg-muted/35 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-foreground">
                    {getUser(item.pengirimId, users)?.name} <ArrowRight className="mx-1 inline h-4 w-4" />{" "}
                    {getUser(item.penerimaId, users)?.name}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {item.routingType === "leadership-notification" ? (
                      <Badge variant="outline">Notifikasi Pimpinan</Badge>
                    ) : null}
                    <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                  </div>
                </div>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.instruksi}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{formatDateTime(item.createdAt)}</span>
                  <span>-</span>
                  <span>{item.allowDownload ? "Unduh diizinkan" : "Preview only"}</span>
                  {item.bypass ? (
                    <>
                      <span>-</span>
                      <span>Bypass hierarchy</span>
                    </>
                  ) : null}
                </div>
                {item.followUpNote ? (
                  <div className="mt-3 rounded-xl border border-border bg-card/80 p-3 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Catatan Penyelesaian</p>
                    <p className="mt-1">{item.followUpNote}</p>
                    {item.followUpFileName ? (
                      <p className="mt-2 flex items-center gap-2 text-xs">
                        <Paperclip className="h-3.5 w-3.5" />
                        {item.followUpFileName}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div>
        <Card className="border-border/80">
          <CardHeader>
            <CardTitle>One-Stop Disposition</CardTitle>
            <CardDescription>
              Panel terpadu untuk memilih target jabatan, individu, instruksi, dan menutup tindak lanjut tanpa pindah
              ke area lain.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-[1.3rem] border border-border bg-muted/35 p-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Users2 className="h-4 w-4 text-primary" />
                Jalur aktif
              </div>
              <p className="mt-2 leading-7">
                {currentUser?.name} sedang bekerja sebagai <strong className="text-foreground">{currentPosition?.name ?? "-"}</strong>.
                Target di bawah mengikuti struktur jabatan efektif Anda.
              </p>
            </div>

            {!canForward ? (
              <p className="rounded-[1.3rem] border border-border bg-muted/35 p-4 text-sm text-muted-foreground">
                Hanya penerima aktif, pejabat pengganti PLH/PLT, atau admin yang dapat meneruskan disposisi ini.
              </p>
            ) : targetPositions.length === 0 ? (
              <p className="rounded-[1.3rem] border border-border bg-muted/35 p-4 text-sm text-muted-foreground">
                Tidak ada target jabatan di bawah struktur aktif Anda untuk disposisi lanjutan.
              </p>
            ) : (
              <>
                {aiConfig.enabled ? (
                  <div className="space-y-4 rounded-[1.35rem] border border-primary/20 bg-primary/5 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <AletaAIMark label="Asisten AI Disposisi" />
                        <p className="mt-2 text-sm text-muted-foreground">
                          Gunakan AI untuk ringkasan sangat singkat, saran instruksi, dan kandidat tujuan disposisi.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isGeneratingAiAssist}
                        onClick={async () => {
                          setIsGeneratingAiAssist(true);
                          setAiAssistError("");

                          try {
                            if (!currentUser) {
                              throw new Error("Sesi pengguna tidak ditemukan. Silakan login ulang.");
                            }

                            const response = await fetch("/api/ai/suggest-disposisi", {
                              method: "POST",
                              headers: {
                                "content-type": "application/json",
                                "x-aleta-user-id": currentUser.id,
                              },
                              body: JSON.stringify({
                                actorUserId: currentUser.id,
                                letterSubject: letter.perihal,
                                letterSummary: letter.ringkasan,
                                currentInstruction: instruksi,
                                targetOptions: targetPositionOptions,
                              }),
                            });
                            const payload = (await response.json()) as {
                              ok?: boolean;
                              data?: {
                                suggestion?: {
                                  summary: string;
                                  suggestedInstruction: string;
                                  suggestedTargetLabel: string;
                                };
                              };
                              error?: { message?: string };
                            };

                            if (!response.ok || !payload.ok || !payload.data?.suggestion) {
                              throw new Error(payload.error?.message ?? "Saran AI disposisi tidak dapat dijalankan.");
                            }

                            setAiAssist(payload.data.suggestion);
                          } catch (error) {
                            setAiAssist(null);
                            setAiAssistError(
                              error instanceof Error
                                ? error.message
                                : "Saran AI disposisi tidak dapat dijalankan."
                            );
                          } finally {
                            setIsGeneratingAiAssist(false);
                          }
                        }}
                      >
                        <Sparkles className="h-4 w-4" />
                        {isGeneratingAiAssist ? "Menyusun..." : "Saran AI"}
                      </Button>
                    </div>

                    {aiAssist ? (
                      <div className="grid gap-3 lg:grid-cols-[0.92fr_1.08fr]">
                        <div className="rounded-[1.15rem] border border-border bg-card/80 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Ringkasan inti</p>
                          <p className="mt-2 text-sm leading-7 text-muted-foreground">{aiAssist.summary}</p>
                          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Target disarankan</p>
                          <p className="mt-2 text-sm text-foreground">{aiAssist.suggestedTargetLabel}</p>
                        </div>
                        <div className="rounded-[1.15rem] border border-border bg-card/80 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Saran instruksi</p>
                          <p className="mt-2 text-sm leading-7 text-muted-foreground">{aiAssist.suggestedInstruction}</p>
                          <div className="mt-4">
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => {
                                setInstruksi(aiAssist.suggestedInstruction);
                                const matchedTarget = targetPositionOptions.find(
                                  (option) => option.label === aiAssist.suggestedTargetLabel
                                );

                                if (matchedTarget) {
                                  const matchedUsers = getUsersByPosition(matchedTarget.id);
                                  setTargetPositionId(matchedTarget.id);
                                  setPenerimaId(matchedUsers[0]?.id ?? "");
                                }
                              }}
                            >
                              Gunakan saran AI
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {aiAssistError ? (
                      <div className="rounded-[1.15rem] border border-rose-300/60 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-200">
                        {aiAssistError}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="space-y-3 rounded-[1.3rem] border border-border bg-card/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Pilih target jabatan</p>
                      <p className="text-xs text-muted-foreground">Klik satu jabatan, lalu individu tujuan akan langsung tersedia.</p>
                    </div>
                    {currentUser?.canBypassHierarchy ? (
                      <SwitchRow
                        testId="switch-bypass"
                        label="Bypass"
                        checked={bypass}
                        onCheckedChange={setBypass}
                        inline
                      />
                    ) : null}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {targetPositions.map((position) => {
                      const users = getUsersByPosition(position.id);

                      return (
                        <button
                          key={position.id}
                          type="button"
                          data-testid={`target-position-${position.id}`}
                          className={cn(
                            "rounded-[1.2rem] border px-4 py-3 text-left transition",
                            selectedTargetPositionId === position.id
                              ? "border-primary/40 bg-primary/10 shadow-sm"
                              : "border-border bg-muted/20 hover:border-primary/30 hover:bg-primary/5"
                          )}
                          onClick={() => {
                            setTargetPositionId(position.id);
                            setPenerimaId(users[0]?.id ?? "");
                          }}
                        >
                          <p className="font-semibold text-foreground">{position.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{position.unitKerja}</p>
                          <p className="mt-3 text-xs font-medium text-primary">{users.length} akun tersedia</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Target individu</label>
                  <NativeSelect
                    data-testid="select-user"
                    value={selectedRecipientId}
                    onChange={(event) => setPenerimaId(event.target.value)}
                  >
                    {availableUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} - {getUserPositionLabel(user)}
                      </option>
                    ))}
                  </NativeSelect>
                  {availableUsers.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Belum ada user aktif pada jabatan ini. Pilih jabatan lain atau ubah mapping user terlebih dahulu.
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Instruksi</label>
                  <Textarea
                    data-testid="textarea-instruksi"
                    value={instruksi}
                    onChange={(event) => setInstruksi(event.target.value)}
                    placeholder="Tuliskan arahan pimpinan atau tindak lanjut yang harus dikerjakan."
                  />
                </div>

                <div className="grid gap-3 rounded-[1.3rem] border border-border bg-muted/35 p-4">
                  <SwitchRow label="Izinkan unduh dokumen" checked={allowDownload} onCheckedChange={setAllowDownload} />
                  <SwitchRow label="Tandai prioritas tinggi" checked={urgent} onCheckedChange={setUrgent} />
                </div>

                <Button
                  data-testid="submit-disposition"
                  className="w-full"
                  disabled={!instruksi.trim() || !selectedRecipientId || !selectedTargetPositionId}
                  onClick={() => {
                    createDisposition({
                      suratId: letter.id,
                      parentDispositionId: disposition.id,
                      penerimaId: selectedRecipientId,
                      targetPositionId: selectedTargetPositionId,
                      instruksi,
                      allowDownload,
                      urgent,
                      bypass,
                      routingType: "standard",
                    });
                    setInstruksi("");
                    router.push(`/surat/${letter.id}`);
                  }}
                >
                  <Send className="h-4 w-4" />
                  Kirim disposisi lanjutan
                </Button>
              </>
            )}

            <div className="border-t border-border pt-5">
              <div className="space-y-4">
                <div>
                  <h3 className="font-serif text-xl text-foreground">Closed-Loop Completion</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Jika Anda adalah penerima terakhir, tindak lanjut dapat ditutup dari panel yang sama.
                  </p>
                </div>

                {!isFinalRecipient ? (
                  <p className="rounded-[1.3rem] border border-border bg-muted/35 p-4 text-sm text-muted-foreground">
                    Form penyelesaian aktif ketika node ini tidak lagi diteruskan ke turunan lain dan Anda adalah penerima terakhir.
                  </p>
                ) : (
                  <>
                    <div className="rounded-[1.3rem] border border-emerald-400/25 bg-emerald-500/10 p-4 text-sm text-emerald-900 dark:text-emerald-200">
                      <div className="flex items-center gap-2 font-medium">
                        <Clock3 className="h-4 w-4" />
                        Penerima terakhir terdeteksi
                      </div>
                      <p className="mt-2 leading-7">
                        {recipient?.name} dapat menutup surat ini dengan bukti tindak lanjut. Status surat akan berubah menjadi selesai.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Catatan tindak lanjut</label>
                      <Textarea
                        data-testid="textarea-followup"
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        placeholder="Jelaskan bukti penyelesaian atau ringkasan hasil tindak lanjut."
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Nama berkas lampiran</label>
                      <Input
                        data-testid="input-followup-file"
                        value={fileName}
                        onChange={(event) => setFileName(event.target.value)}
                      />
                    </div>
                    <Button
                      data-testid="submit-followup"
                      className="w-full"
                      variant="secondary"
                      disabled={!note.trim()}
                      onClick={() => {
                        completeDisposition({
                          dispositionId: disposition.id,
                          note,
                          fileName,
                        });
                        router.push(`/surat/${letter.id}`);
                      }}
                    >
                      <ShieldCheck className="h-4 w-4" />
                      Tandai selesai
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="rounded-[1.3rem] border border-border bg-muted/35 p-4 text-sm leading-7 text-muted-foreground">
              Kembali ke detail surat bila Anda ingin mengecek viewer atau metadata sebelum melanjutkan.
              <div className="mt-4">
                <Button asChild variant="outline" className="w-full">
                  <Link href={`/surat/${letter.id}`}>
                    Kembali ke detail surat
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Info({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm leading-7 text-foreground">{value}</p>
    </div>
  );
}

function SwitchRow({
  label,
  checked,
  onCheckedChange,
  description,
  testId,
  inline,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  description?: string;
  testId?: string;
  inline?: boolean;
}) {
  return (
    <label className={cn("flex items-start justify-between gap-4", inline && "items-center")}>
      <span className="space-y-1">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {description ? <span className="block text-xs text-muted-foreground">{description}</span> : null}
      </span>
      <Switch data-testid={testId} checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  );
}
