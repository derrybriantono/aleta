"use client";

import { useMemo, useState } from "react";
import { CalendarRange, ShieldCheck, UserCog } from "lucide-react";

import {
  getEligibleCandidatesForActingAssignment,
  getPositionById,
  isCourtLeadershipTarget,
  isActingAssignmentActive,
  resolveEffectivePositionId,
} from "@/core/organization/service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { usePortal } from "@/lib/app-state";
import { canManageActingAssignments, getUserPositionLabel } from "@/lib/permissions";

function getDateInputValue(offsetDays = 0) {
  const value = new Date();
  value.setDate(value.getDate() + offsetDays);
  return value.toISOString().slice(0, 10);
}

function summarizeEligibility(reasons: string[], warnings: string[]) {
  return [...reasons, ...warnings].filter(Boolean).join(" ");
}

export function ActingAssignmentPanel() {
  const { assignActingAssignment, clearActingAssignment, currentUser, users } = usePortal();
  const [supervisorUserId, setSupervisorUserId] = useState("");
  const [assigneeUserId, setAssigneeUserId] = useState("");
  const [assignmentType, setAssignmentType] = useState<"PLH" | "PLT">("PLH");
  const [startDate, setStartDate] = useState(getDateInputValue());
  const [endDate, setEndDate] = useState(getDateInputValue(7));
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  const supervisors = useMemo(
    () =>
      users
        .filter((user) => {
          const targetPosition = getPositionById(resolveEffectivePositionId(user) ?? "");
          return getEligibleCandidatesForActingAssignment(targetPosition, assignmentType, {
            userSource: users,
            supervisorUser: user,
          }).length > 0;
        })
        .sort((left, right) => left.name.localeCompare(right.name)),
    [assignmentType, users]
  );
  const selectedSupervisor =
    supervisors.find((user) => user.id === supervisorUserId) ?? supervisors[0] ?? null;
  const targetPosition = selectedSupervisor
    ? getPositionById(resolveEffectivePositionId(selectedSupervisor) ?? "")
    : null;
  const candidateEvaluations = useMemo(
    () =>
      getEligibleCandidatesForActingAssignment(targetPosition, assignmentType, {
        userSource: users,
        supervisorUser: selectedSupervisor,
        includeIneligible: true,
      }),
    [assignmentType, selectedSupervisor, targetPosition, users]
  );
  const eligibleCandidateEvaluations = candidateEvaluations.filter((item) => item.eligibility.eligible);
  const selectedAssignee =
    eligibleCandidateEvaluations.find((item) => item.user.id === assigneeUserId)?.user ??
    eligibleCandidateEvaluations[0]?.user ??
    null;
  const selectedCandidateEvaluation = candidateEvaluations.find((item) => item.user.id === selectedAssignee?.id);
  const activeAssignments = users
    .filter((user) => isActingAssignmentActive(user.actingAssignment))
    .sort((left, right) => left.name.localeCompare(right.name));

  if (!canManageActingAssignments(currentUser)) {
    return null;
  }

  const leadershipTarget = isCourtLeadershipTarget(targetPosition);

  return (
    <Card className="border-border/80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCog className="h-5 w-5 text-primary" />
          Penugasan PLH / PLT
        </CardTitle>
        <CardDescription>
          Dikelola terpusat di Dashboard Manajemen Surat. Validasi kandidat dilakukan di UI dan server agar PLH/PLT tetap sesuai jalur jabatan.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-5 rounded-[1.5rem] border border-border bg-muted/40 p-5">
          <div className="rounded-[1.2rem] border border-primary/40 bg-primary/10 p-4 text-sm text-foreground dark:bg-primary/[0.08]">
            PLH/PLT wajib menyertakan alasan dan rentang waktu aktif. PLT dibatasi paling lama 3 bulan per periode dan dapat diperpanjang melalui penugasan baru yang diaudit.
            {leadershipTarget ? (
              <span className="mt-2 block">
                Untuk jabatan pimpinan pengadilan, Hakim aktif/senior dalam satuan kerja yang sama dapat menjadi kandidat PLH/PLT sesuai aturan dan praktik penunjukan.
              </span>
            ) : null}
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Atasan pemberi tugas">
              <NativeSelect
                value={selectedSupervisor?.id ?? ""}
                onChange={(event) => {
                  setFeedback(null);
                  setSupervisorUserId(event.target.value);
                  setAssigneeUserId("");
                }}
                className="h-11 text-base"
              >
                {supervisors.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} - {getUserPositionLabel(user)}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <Field label="Kandidat PLH/PLT">
              <NativeSelect
                value={selectedAssignee?.id ?? ""}
                onChange={(event) => {
                  setFeedback(null);
                  setAssigneeUserId(event.target.value);
                }}
                className="h-11 text-base"
              >
                {candidateEvaluations.map(({ user, eligibility }) => (
                  <option key={user.id} value={user.id} disabled={!eligibility.eligible}>
                    {eligibility.eligible ? "" : "[Tidak eligible] "}
                    {user.name} - {getUserPositionLabel(user)}
                  </option>
                ))}
              </NativeSelect>
              {selectedCandidateEvaluation ? (
                <p className="text-xs text-muted-foreground">
                  {summarizeEligibility(
                    selectedCandidateEvaluation.eligibility.reasons,
                    selectedCandidateEvaluation.eligibility.warnings
                  )}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Tidak ada kandidat eligible untuk jabatan target ini.</p>
              )}
            </Field>
          </div>

          <div className="grid gap-5 md:grid-cols-[0.8fr_1.2fr]">
            <Field label="Tipe penugasan">
              <NativeSelect
                value={assignmentType}
                onChange={(event) => {
                  setFeedback(null);
                  setAssignmentType(event.target.value as "PLH" | "PLT");
                }}
                className="h-11 text-base"
              >
                <option value="PLH">PLH</option>
                <option value="PLT">PLT</option>
              </NativeSelect>
            </Field>

            <div className="rounded-[1.2rem] border border-border bg-card/80 p-4">
              <p className="text-sm font-semibold text-foreground">Jabatan yang diemban</p>
              <p className="mt-1 text-sm text-muted-foreground">{targetPosition?.name ?? "-"}</p>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Tanggal mulai">
              <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="h-11 text-base" />
            </Field>
            <Field label={`Tanggal akhir ${assignmentType}`}>
              <Input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="h-11 text-base"
              />
            </Field>
          </div>

          <Field label="Alasan penugasan">
            <Input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={assignmentType === "PLH" ? "Pejabat definitif berhalangan sementara" : "Jabatan kosong/pejabat definitif berhalangan tetap"}
              className="h-11 text-base"
            />
          </Field>

          {feedback ? (
            <div
              className={`rounded-[1.2rem] border px-4 py-3 text-sm ${
                feedback.tone === "success"
                  ? "border-emerald-300/60 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                  : "border-rose-300/60 bg-rose-500/10 text-rose-700 dark:text-rose-200"
              }`}
            >
              {feedback.message}
            </div>
          ) : null}

          <Button
            className="w-full"
            disabled={!selectedAssignee || !reason.trim()}
            onClick={async () => {
              const result = await assignActingAssignment({
                supervisorUserId: selectedSupervisor?.id ?? "",
                assigneeUserId: selectedAssignee?.id ?? "",
                type: assignmentType,
                startDate,
                endDate,
                reason,
              });

              setFeedback({
                tone: result.ok ? "success" : "error",
                message: result.message,
              });
            }}
          >
            <ShieldCheck className="h-4 w-4" />
            Simpan Penugasan
          </Button>
        </div>

        <div className="space-y-4 rounded-[1.5rem] border border-border bg-card/95 p-5">
          <div className="flex items-center gap-2 text-primary">
            <CalendarRange className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em]">Penugasan Aktif</p>
          </div>

          {activeAssignments.length === 0 ? (
            <div className="rounded-[1.2rem] border border-dashed border-border bg-muted/35 p-4 text-sm text-muted-foreground">
              Belum ada penugasan PLH/PLT aktif saat ini.
            </div>
          ) : (
            activeAssignments.map((user) => {
              const supervisor = users.find((candidate) => candidate.id === user.actingAssignment?.authorizedByUserId);
              const targetPosition = getPositionById(user.actingAssignment?.positionId ?? "");

              return (
                <div key={user.id} className="rounded-[1.2rem] border border-border bg-card/90 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">
                        {user.actingAssignment?.type} - {user.name}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {getUserPositionLabel(user)} menjalankan {targetPosition?.name ?? "-"}
                      </p>
                    </div>
                    <Badge variant="warning">{user.actingAssignment?.type}</Badge>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Otorisasi jabatan: {supervisor?.name ?? "-"} / {getUserPositionLabel(supervisor ?? null)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {user.actingAssignment?.type === "PLH"
                      ? `${user.actingAssignment.startDate?.slice(0, 10)} s.d. ${user.actingAssignment.endDate?.slice(0, 10)}`
                      : `Aktif sejak ${user.actingAssignment?.startDate?.slice(0, 10) ?? "-"}`}
                  </p>
                  <div className="mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const result = await clearActingAssignment(user.id);
                        setFeedback({
                          tone: result.ok ? "success" : "error",
                          message: result.message,
                        });
                      }}
                    >
                      Nonaktifkan
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-foreground">{label}</label>
      {children}
    </div>
  );
}
