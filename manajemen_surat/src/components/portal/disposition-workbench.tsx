"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Clock3,
  FileSearch,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { AletaAIMark } from "@/components/branding/aleta-ai-mark";
import { statusVariant } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { usePortal } from "@/lib/app-state";
import {
  getDispositionDeadlineLabel,
  getDispositionDeadlineState,
  getDispositionReadLabel,
} from "@/lib/disposition-status";
import { formatDateTime } from "@/lib/format";
import {
  getAllowedDispositionTargetPositions,
  getPosition,
  getUser,
  getUserPositionLabel,
  isDispositionAssignedToUser,
  isPrivilegedAdmin,
} from "@/lib/permissions";
import {
  type DispositionNode,
  type DispositionSuggestionPayload,
  type DispositionSuggestionPriorityLevel,
  type LetterDetail,
} from "@/lib/types";
import {
  DispositionSuggestionRequestError,
  fetchDispositionSuggestionInsight,
} from "@/modules/manajemen-surat/services/aleta-disposition-intelligence";
import { cn } from "@/lib/utils";

type AiAssistState =
  | { status: "idle"; insight: null; errorMessage: null }
  | { status: "loading"; insight: null; errorMessage: null }
  | { status: "ready"; insight: DispositionSuggestionPayload; errorMessage: null }
  | { status: "error"; insight: null; errorMessage: string };

const PRIORITY_COPY: Record<
  DispositionSuggestionPriorityLevel,
  { label: string; variant: "success" | "warning" | "danger" | "default" }
> = {
  low: { label: "Prioritas rendah", variant: "success" },
  medium: { label: "Prioritas sedang", variant: "default" },
  high: { label: "Prioritas tinggi", variant: "warning" },
  urgent: { label: "Mendesak / urgent", variant: "danger" },
};

type ComposerProps = {
  letter: LetterDetail;
  disposition: DispositionNode;
};

export function DispositionWorkbench({ letter, disposition }: ComposerProps) {
  const router = useRouter();
  const { currentUser, aiConfig, createDisposition, startDisposition, completeDisposition, dispositions, getUsersByPosition, users } = usePortal();
  const isAdmin = isPrivilegedAdmin(currentUser);
  const dispositionFlags = aiConfig.featureFlags.oneStopDisposition;
  const dispositionAiEnabled = aiConfig.enabled && aiConfig.featureDisposisiAi && dispositionFlags.enabled;
  const [targetPositionId, setTargetPositionId] = useState("");
  const [penerimaId, setPenerimaId] = useState("");
  const [instruksi, setInstruksi] = useState("");
  const [allowDownload, setAllowDownload] = useState(disposition.allowDownload);
  const [urgent, setUrgent] = useState(false);
  const [bypass, setBypass] = useState(false);
  const [deadlineAt, setDeadlineAt] = useState("");
  const [note, setNote] = useState("");
  const [fileName, setFileName] = useState("laporan-tindak-lanjut.pdf");
  const [aiState, setAiState] = useState<AiAssistState>({
    status: "idle",
    insight: null,
    errorMessage: null,
  });

  const recipient = getUser(disposition.penerimaId, users);
  const canForward = isDispositionAssignedToUser(currentUser, disposition);
  const deadlineState = getDispositionDeadlineState(disposition);
  // Active work children block the completion of this node.
  const activeWorkChildren = dispositions.filter(
    (item) =>
      item.parentDispositionId === disposition.id &&
      item.routingType === "standard" &&
      item.status !== "Selesai"
  );
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

  const requestDispositionSuggestion = async () => {
    if (!dispositionAiEnabled || !dispositionFlags.recommendation) {
      setAiState({
        status: "error",
        insight: null,
        errorMessage: "AI sedang dinonaktifkan oleh administrator.",
      });
      return;
    }
    if (!currentUser) {
      setAiState({
        status: "error",
        insight: null,
        errorMessage: "Sesi pengguna tidak ditemukan. Silakan login ulang.",
      });
      return;
    }
    setAiState({ status: "loading", insight: null, errorMessage: null });
    try {
      const insight = await fetchDispositionSuggestionInsight({
        letterId: letter.id,
        actorUserId: currentUser.id,
        currentInstruction: instruksi,
        targetOptions: targetPositionOptions,
      });
      setAiState({ status: "ready", insight, errorMessage: null });
    } catch (error) {
      const message =
        error instanceof DispositionSuggestionRequestError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Saran AI disposisi tidak dapat dijalankan saat ini.";
      setAiState({ status: "error", insight: null, errorMessage: message });
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAiState({ status: "idle", insight: null, errorMessage: null });
  }, [letter.id]);

  const applyAiAutofill = () => {
    if (aiState.status !== "ready" || !aiState.insight) return;
    if (!dispositionFlags.autofill) return;
    const autofill = aiState.insight.autofill;
    if (autofill.suggestedInstruction) {
      setInstruksi(autofill.suggestedInstruction);
    }
    const targetId = autofill.suggestedTargetPositionId;
    if (targetId && targetPositions.some((position) => position.id === targetId)) {
      const matchedUsers = getUsersByPosition(targetId);
      setTargetPositionId(targetId);
      setPenerimaId(matchedUsers[0]?.id ?? "");
    }
    if (typeof autofill.urgent === "boolean") {
      setUrgent(autofill.urgent);
    }
    if (typeof autofill.allowDownload === "boolean") {
      setAllowDownload(autofill.allowDownload);
    }
  };

  return (
    <div className="space-y-5">
      {/* Compact context card — Ringkasan + Timeline */}
      <Card className={cn("border-border/80", disposition.urgent && "border-orange-400/60 bg-orange-50/30 dark:bg-orange-950/20")}>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">Disposisi Aktif</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {recipient?.name ?? "-"} · {getPosition(disposition.targetPositionId)?.name ?? "-"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {disposition.urgent ? (
                <Badge variant="danger">Prioritas Tinggi</Badge>
              ) : null}
              {!disposition.readAt && disposition.status !== "Selesai" ? (
                <Badge variant="warning">Belum Dibaca</Badge>
              ) : null}
              {deadlineState === "overdue" ? (
                <Badge variant="danger">Terlambat</Badge>
              ) : deadlineState === "due_today" ? (
                <Badge variant="warning">Jatuh Tempo Hari Ini</Badge>
              ) : null}
              <Badge variant={statusVariant(disposition.status)}>{disposition.status}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="rounded-[1.1rem] border border-border bg-muted/30 px-4 py-3 text-sm leading-7 text-foreground">
            {disposition.instruksi || "Tidak ada instruksi."}
          </p>
          <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-muted/25 px-3 py-2">
              <span className="font-medium text-foreground">Deadline:</span>{" "}
              {getDispositionDeadlineLabel(disposition)}
            </div>
            <div className="rounded-xl border border-border bg-muted/25 px-3 py-2">
              <span className="font-medium text-foreground">Status baca:</span>{" "}
              {getDispositionReadLabel(disposition)}
            </div>
          </div>
          {timeline.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Alur Disposisi
              </p>
              {timeline.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 rounded-xl border border-border bg-muted/25 px-3 py-2"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                    {index + 1}
                  </span>
                  <p className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {getUser(item.pengirimId, users)?.name} → {getUser(item.penerimaId, users)?.name}
                  </p>
                  <Badge variant={statusVariant(item.status)} className="shrink-0 text-xs">
                    {item.status}
                  </Badge>
                  {!item.readAt && item.status !== "Selesai" ? (
                    <Badge variant="warning" className="shrink-0 text-xs">
                      Belum Dibaca
                    </Badge>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Main action card */}
      <Card className="border-border/80">
        <CardHeader>
          <CardTitle>One-Stop Disposition</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
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
              {dispositionAiEnabled ? (
                <DispositionAiPanel
                  state={aiState}
                  onRequest={requestDispositionSuggestion}
                  onApplyAutofill={applyAiAutofill}
                  isAdmin={isAdmin}
                  canApplyAutofill={dispositionFlags.autofill}
                />
              ) : (
                <div className="rounded-[1.35rem] border border-border bg-muted/25 px-5 py-4 text-sm text-muted-foreground">
                  <AletaAIMark label="Asisten AI Disposisi" />
                  <p className="mt-2">Fitur ini sedang dinonaktifkan oleh administrator.</p>
                </div>
              )}

              <div className="space-y-3 rounded-[1.3rem] border border-border bg-card/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">Pilih target jabatan</p>
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

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Deadline disposisi</label>
                <Input
                  type="datetime-local"
                  value={deadlineAt}
                  onChange={(event) => setDeadlineAt(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Opsional. Dipakai untuk badge Terlambat/Jatuh Tempo di daftar tugas dan detail surat.
                </p>
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
                    deadlineAt: deadlineAt ? new Date(deadlineAt).toISOString() : null,
                    routingType: "standard",
                  });
                  setInstruksi("");
                  setDeadlineAt("");
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
              <p className="text-sm font-semibold text-foreground">Tindak Lanjut</p>

              {/* Explicit "Mulai Kerjakan" trigger */}
              {canForward && disposition.status === "Menunggu Tindak Lanjut" ? (
                <div className="rounded-[1.3rem] border border-primary/25 bg-primary/5 p-4 text-sm">
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <Clock3 className="h-4 w-4 text-primary" />
                    Disposisi menunggu tindak lanjut
                  </div>
                  <Button
                    data-testid="btn-start-disposition"
                    className="mt-3 w-full"
                    variant="outline"
                    onClick={() => {
                      void startDisposition(disposition.id);
                    }}
                  >
                    <Clock3 className="h-4 w-4" />
                    Mulai Kerjakan
                  </Button>
                </div>
              ) : null}

              {!canForward ? (
                <p className="rounded-[1.3rem] border border-border bg-muted/35 p-4 text-sm text-muted-foreground">
                  Hanya penerima aktif yang dapat menyelesaikan node ini.
                </p>
              ) : disposition.status === "Selesai" ? (
                <p className="rounded-[1.3rem] border border-border bg-muted/35 p-4 text-sm text-muted-foreground">
                  Node ini sudah ditandai selesai.
                </p>
              ) : activeWorkChildren.length > 0 ? (
                <div className="rounded-[1.3rem] border border-amber-300/60 bg-amber-50/50 p-4 text-sm text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
                  <p className="font-medium">Tidak dapat diselesaikan.</p>
                  <p className="mt-1 leading-7">
                    Masih ada {activeWorkChildren.length} disposisi turunan yang belum selesai. Selesaikan semua node kerja turunan terlebih dahulu.
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Catatan tindak lanjut <span className="text-destructive">*</span>
                    </label>
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

          <Button asChild variant="outline" className="w-full">
            <Link href={`/surat/${letter.id}`}>
              Kembali ke detail surat
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
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

function DispositionAiPanel({
  state,
  onRequest,
  onApplyAutofill,
  isAdmin,
  canApplyAutofill,
}: {
  state: AiAssistState;
  onRequest: () => void;
  onApplyAutofill: () => void;
  isAdmin: boolean;
  canApplyAutofill: boolean;
}) {
  const isLoading = state.status === "loading";
  const buttonLabel = isLoading
    ? "Memanggil AI..."
    : state.status === "ready"
      ? "Minta ulang saran AI"
      : state.status === "error"
        ? "Coba lagi"
        : "Minta saran AI";

  return (
    <div className="space-y-4 rounded-[1.35rem] border border-primary/20 bg-primary/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <AletaAIMark label="Asisten AI Disposisi" />
          <p className="mt-2 text-sm text-muted-foreground">
            {isAdmin
              ? "Backend memanggil provider/model AI aktif dari Pengaturan AI. Status sumber (AI live / heuristik / dimatikan / error) selalu ditampilkan jujur."
              : "AI akan menyarankan instruksi dan target disposisi berdasarkan isi surat."}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={isLoading}
          data-testid="btn-request-disposition-ai"
          onClick={onRequest}
        >
          <Sparkles className="h-4 w-4" />
          {buttonLabel}
        </Button>
      </div>

      {state.status === "idle" ? (
        <p className="rounded-[1.15rem] border border-dashed border-primary/30 bg-card/70 px-4 py-3 text-sm text-muted-foreground">
          {isAdmin
            ? "Tekan tombol untuk meminta analisis AI nyata. Jika provider sedang tidak aktif, panel akan tetap menampilkan fallback heuristik secara eksplisit."
            : "Tekan tombol untuk mendapatkan saran AI."}
        </p>
      ) : null}

      {state.status === "loading" ? <DispositionAiLoading /> : null}

      {state.status === "error" ? (
        <div className="rounded-[1.2rem] border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 dark:text-rose-200">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            Saran AI tidak dapat dimuat.
          </div>
          <p className="mt-2">{state.errorMessage}</p>
        </div>
      ) : null}

      {state.status === "ready" ? (
        <DispositionAiBody
          insight={state.insight}
          onApplyAutofill={onApplyAutofill}
          isAdmin={isAdmin}
          canApplyAutofill={canApplyAutofill}
        />
      ) : null}
    </div>
  );
}

function DispositionAiBody({
  insight,
  onApplyAutofill,
  isAdmin,
  canApplyAutofill,
}: {
  insight: DispositionSuggestionPayload;
  onApplyAutofill: () => void;
  isAdmin: boolean;
  canApplyAutofill: boolean;
}) {
  const priority = PRIORITY_COPY[insight.priority.level];
  const providerLabel = insight.provider.connectionLabel ?? insight.provider.providerName;
  const confidencePercent = Math.round(insight.confidence.score * 100);
  const isLive = insight.source === "ai-live";
  const sourceTone = isLive
    ? "border-primary/40 bg-primary/10"
    : insight.source === "error"
      ? "border-rose-300 bg-rose-50"
      : "border-amber-300 bg-amber-50";

  return (
    <div className="space-y-4">
      {/* Source indicator — full for admin, simplified for regular user */}
      {isAdmin ? (
        <div className={cn("rounded-[1.25rem] border p-4 text-sm", sourceTone)}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={isLive ? "default" : insight.source === "error" ? "danger" : "warning"}>
              {isLive ? "Saran AI live" : insight.source === "disabled" ? "AI dimatikan" : insight.source === "error" ? "Provider AI gagal" : "Fallback heuristik"}
            </Badge>
            <Badge variant="outline">Provider: {providerLabel}</Badge>
            <Badge variant="outline">
              Model: {insight.provider.providerModelId || insight.provider.modelId}
            </Badge>
            <Badge variant="outline">
              Bahasa: {insight.provider.language === "id" ? "Bahasa Indonesia" : "English"}
            </Badge>
            <Badge
              variant={
                insight.provider.connectionStatus === "connected"
                  ? "success"
                  : insight.provider.connectionStatus === "failed"
                    ? "danger"
                    : "outline"
              }
            >
              Status koneksi: {insight.provider.connectionStatus}
            </Badge>
            <Badge variant={insight.provider.hasActiveApiKey ? "success" : "warning"}>
              API key: {insight.provider.hasActiveApiKey ? "terisi" : "belum diisi"}
            </Badge>
          </div>
          <p className="mt-3 text-muted-foreground">{insight.rationale}</p>
          {insight.message ? (
            <p className="mt-2 text-xs font-medium text-amber-700">{insight.message}</p>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 rounded-[1.2rem] border border-border bg-muted/20 px-4 py-2.5 text-sm">
          <Badge variant={isLive ? "default" : insight.source === "error" ? "danger" : "warning"}>
            {isLive ? "Saran AI" : insight.source === "disabled" ? "AI tidak aktif" : insight.source === "error" ? "AI gagal" : "Analisis otomatis"}
          </Badge>
          {insight.message ? (
            <span className="font-medium text-amber-700">{insight.message}</span>
          ) : null}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-4 rounded-[1.3rem] border border-border bg-card/80 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                Ringkasan & prioritas
              </p>
            </div>
            <Badge variant={priority.variant}>{priority.label}</Badge>
          </div>

          <p className="text-sm leading-7 text-foreground">{insight.summary}</p>

          {isAdmin ? (
            <div className="rounded-[1.1rem] border border-dashed border-primary/30 bg-muted/30 p-3 text-xs text-muted-foreground">
              Alasan prioritas: {insight.priority.reason}
            </div>
          ) : null}

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Temuan utama</p>
            {insight.keyFindings.length === 0 ? (
              <p className="rounded-[1.1rem] border border-border bg-muted/25 px-4 py-3 text-sm text-muted-foreground">
                AI belum menemukan poin konkret dari data yang tersedia.
              </p>
            ) : (
              insight.keyFindings.map((point, index) => (
                <div
                  key={`${index}-${point.slice(0, 20)}`}
                  className="rounded-[1.1rem] border border-border bg-muted/25 px-4 py-3 text-sm text-muted-foreground"
                >
                  {point}
                </div>
              ))
            )}
          </div>

          {isAdmin ? (
            <div>
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                <span>Confidence</span>
                <span>
                  {confidencePercent}% · {insight.confidence.label}
                </span>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-muted">
                <div
                  className={cn(
                    "h-2 rounded-full",
                    insight.confidence.level === "high"
                      ? "bg-emerald-500"
                      : insight.confidence.level === "medium"
                        ? "bg-amber-500"
                        : "bg-rose-500"
                  )}
                  style={{ width: `${Math.max(6, Math.min(100, confidencePercent))}%` }}
                />
              </div>
              {insight.confidence.level === "low" ? (
                <p className="mt-2 text-xs font-medium text-amber-700">
                  Keyakinan rendah. Jangan jadikan keputusan final tanpa verifikasi manual.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Keyakinan:</span>
              <Badge
                variant={
                  insight.confidence.level === "high"
                    ? "success"
                    : insight.confidence.level === "medium"
                      ? "default"
                      : "warning"
                }
              >
                {insight.confidence.label}
              </Badge>
              {insight.confidence.level === "low" ? (
                <span className="text-xs text-amber-700">Verifikasi manual diperlukan.</span>
              ) : null}
            </div>
          )}
        </div>

        <div className="space-y-4 rounded-[1.3rem] border border-border bg-card/80 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Saran instruksi</p>
            <p className="mt-2 whitespace-pre-line rounded-[1.05rem] border border-border bg-muted/25 p-3 text-sm leading-7 text-foreground">
              {insight.suggestedInstruction}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Saran target jabatan</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {insight.suggestedTargetLabel ? (
                <Badge variant="warning">{insight.suggestedTargetLabel}</Badge>
              ) : (
                <Badge variant="outline">Belum ada saran target spesifik</Badge>
              )}
              {insight.autofill.urgent === true ? <Badge variant="danger">Tandai urgent</Badge> : null}
              {insight.autofill.allowDownload === true ? (
                <Badge variant="success">Izinkan unduh</Badge>
              ) : insight.autofill.allowDownload === false ? (
                <Badge variant="muted">Preview only</Badge>
              ) : null}
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            data-testid="btn-apply-disposition-ai"
            onClick={onApplyAutofill}
            disabled={
              !canApplyAutofill ||
              !insight.autofill.suggestedInstruction.trim() &&
              !insight.autofill.suggestedTargetPositionId
            }
          >
            Terapkan ke form
          </Button>
          <p className="text-xs text-muted-foreground">
            Field form akan terisi otomatis. Periksa sebelum mengirim.
          </p>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Saran tindak lanjut
            </p>
            <div className="mt-2 space-y-2">
              {insight.followUpSuggestions.length === 0 ? (
                <p className="rounded-[1.05rem] border border-dashed border-border bg-muted/25 p-3 text-sm text-muted-foreground">
                  AI tidak menyarankan langkah tambahan.
                </p>
              ) : (
                insight.followUpSuggestions.map((item) => (
                  <div key={item.id} className="rounded-[1.05rem] border border-border bg-muted/25 p-3">
                    <p className="text-sm font-semibold text-foreground">{item.label}</p>
                    <p className="mt-1 text-sm leading-7 text-muted-foreground">{item.detail}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {insight.regulations.length > 0 ? (
        <div className="rounded-[1.3rem] border border-border bg-card/80 p-5">
          <div className="flex items-center gap-2 text-primary">
            <FileSearch className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em]">Regulasi rujukan</p>
          </div>
          <div className="mt-3 space-y-2">
            {insight.regulations.map((regulation) => (
              <div key={regulation.id} className="rounded-[1.05rem] border border-border bg-muted/25 p-3">
                <p className="text-sm font-semibold text-foreground">{regulation.title}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {regulation.citation}
                </p>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{regulation.summary}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {isAdmin ? (
        <div className="rounded-[1.3rem] border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-amber-800">
            <ShieldCheck className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em]">Verifikasi manual wajib</p>
          </div>
          <ul className="mt-3 space-y-2 text-sm leading-7 text-amber-900">
            {insight.verificationChecklist.map((item, index) => (
              <li key={`${index}-${item.slice(0, 24)}`} className="flex items-start gap-2">
                <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-amber-600" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-amber-800">Saran AI ini harus diverifikasi manual sebelum disposisi dikirim.</p>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-[1.3rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span>Verifikasi saran AI sebelum mengirim disposisi.</span>
        </div>
      )}
    </div>
  );
}

function DispositionAiLoading() {
  return (
    <div className="space-y-3 rounded-[1.25rem] border border-border bg-muted/30 p-4">
      <div className="h-4 w-40 rounded-full bg-muted" />
      <div className="h-4 w-full rounded-full bg-muted/80" />
      <div className="h-4 w-[80%] rounded-full bg-muted/80" />
      <div className="h-16 rounded-[1.1rem] bg-muted/70" />
    </div>
  );
}
