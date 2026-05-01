"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FilePlus2, Send } from "lucide-react";

import { AletaAIMark } from "@/components/branding/aleta-ai-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreatableMultiSelect } from "@/components/ui/creatable-multi-select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { usePortal } from "@/lib/app-state";
import {
  getClassificationOptionByValue,
  getClassificationTitle,
  letterClassificationCatalog,
  letterClassificationLabelOptions,
  letterClassificationOptions,
  letterOriginSuggestions,
} from "@/lib/letter-taxonomy";
import { positions } from "@/lib/mock-data";
import { processPdfUpload, type UploadedPdfDraft } from "@/lib/pdf";
import { readJsonResponseSafe, summarizePlainTextError } from "@/lib/http-response";
import {
  canCreateIncomingLetter,
  canCreateOutgoingLetter,
  getEffectivePosition,
  getEffectivePositionId,
  getLeadershipRecipients,
  getPositionUsers,
  getUserPositionLabel,
  isPrivilegedAdmin,
} from "@/lib/permissions";
import { type LetterDetail } from "@/lib/types";

const confidentialityOptions = ["Biasa", "Penting", "Rahasia"].map((value) => ({ value }));
const viewerOptions = [
  { value: "download", label: "Download Allowed" },
  { value: "preview", label: "Preview Only" },
];
const classificationCategoryOptions = Array.from(
  new Set(letterClassificationCatalog.map((item) => item.category))
).map((value) => ({ value }));
const tagSeedOptions = [
  "#Badilag",
  "#MahkamahAgung",
  "#PeradilanAgama",
  "Prioritas",
  "Monitoring",
  "Telaah Pimpinan",
  "Administrasi",
  "Kepegawaian",
  "Keuangan",
  "Hukum",
].map((value) => ({ value }));

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function buildDefaultNomorUrut(type: LetterDetail["type"], letters: LetterDetail[]) {
  const nextIndex = letters.filter((letter) => letter.type === type).length + 1;
  return String(nextIndex).padStart(3, "0");
}

export function LetterRegistrationPanel({
  defaultType,
}: {
  defaultType: LetterDetail["type"];
}) {
  const searchParams = useSearchParams();
  const { aiConfig, createLetter, currentUser, getUsersByPosition, letters, users } = usePortal();
  const currentPosition = getEffectivePosition(currentUser);
  const currentPositionId = getEffectivePositionId(currentUser);
  const canRegister =
    defaultType === "masuk" ? canCreateIncomingLetter(currentUser) : canCreateOutgoingLetter(currentUser);
  const isAdmin = isPrivilegedAdmin(currentUser);
  const draftMetadataFlags = aiConfig.featureFlags.draftMetadata;
  const draftMetadataEnabled = aiConfig.enabled && aiConfig.featureManajemenSuratAi && draftMetadataFlags.enabled;
  const [open, setOpen] = useState(searchParams.get("compose") === "1");
  const [uploadedPdf, setUploadedPdf] = useState<UploadedPdfDraft | null>(null);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [isDetectingAI, setIsDetectingAI] = useState(false);
  const [draftMode, setDraftMode] = useState<"manual" | "ai">("manual");
  const [nomorUrut, setNomorUrut] = useState("");
  const [nomorSurat, setNomorSurat] = useState("");
  const [tanggalSurat, setTanggalSurat] = useState(todayValue());
  const [tanggalAdministratif, setTanggalAdministratif] = useState(todayValue());
  const [pengirim, setPengirim] = useState("");
  const [perihal, setPerihal] = useState("");
  const [assignedUnit, setAssignedUnit] = useState(currentPosition?.unitKerja ?? "Kesekretariatan");
  const [confidentiality, setConfidentiality] = useState<LetterDetail["confidentiality"]>("Penting");
  const [asalSurat, setAsalSurat] = useState("");
  const [tujuanSurat, setTujuanSurat] = useState("");
  const [kodeKlasifikasi, setKodeKlasifikasi] = useState("");
  const [klasifikasi, setKlasifikasi] = useState("");
  const [klasifikasiTags, setKlasifikasiTags] = useState<string[]>([]);
  const [ringkasan, setRingkasan] = useState("");
  const [lampiran, setLampiran] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [viewerMode, setViewerMode] = useState<LetterDetail["viewerMode"]>("download");
  const [targetPositionId, setTargetPositionId] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [feedback, setFeedback] = useState("");
  const [draftFeedback, setDraftFeedback] = useState("");
  const [formError, setFormError] = useState("");
  const unitOptions = useMemo(
    () => [...new Set(positions.map((position) => position.unitKerja))].map((value) => ({ value })),
    []
  );
  const originOptions = useMemo(
    () => letterOriginSuggestions.map((value) => ({ value })),
    []
  );
  const incomingTargetUsers = useMemo(() => getLeadershipRecipients(users), [users]);
  const nextNomorUrut = useMemo(() => buildDefaultNomorUrut(defaultType, letters), [defaultType, letters]);
  const targetPositions = useMemo(() => {
    if (defaultType === "masuk") {
      return positions
        .filter((position) => ["pos-ketua", "pos-wakil"].includes(position.id))
        .map((position) => ({ value: position.id, label: `${position.name} - ${position.unitKerja}` }));
    }

    return positions
      .filter((position) => position.id !== currentPositionId && getPositionUsers(position.id, users).length > 0)
      .map((position) => ({ value: position.id, label: `${position.name} - ${position.unitKerja}` }));
  }, [currentPositionId, defaultType, users]);
  const availableTargetUsers = useMemo(() => {
    if (!targetPositionId) {
      return defaultType === "masuk" ? incomingTargetUsers : [];
    }

    return getUsersByPosition(targetPositionId);
  }, [defaultType, getUsersByPosition, incomingTargetUsers, targetPositionId]);

  const resetForm = () => {
    setDraftMode("manual");
    setNomorUrut("");
    setNomorSurat("");
    setTanggalSurat(todayValue());
    setTanggalAdministratif(todayValue());
    setPengirim("");
    setPerihal("");
    setAssignedUnit(currentPosition?.unitKerja ?? "Kesekretariatan");
    setConfidentiality("Penting");
    setAsalSurat("");
    setTujuanSurat("");
    setKodeKlasifikasi("");
    setKlasifikasi("");
    setKlasifikasiTags([]);
    setRingkasan("");
    setLampiran([]);
    setTags([]);
    setViewerMode("download");
    setUploadedPdf(null);
    setDraftFeedback("");
    setFormError("");
  };

  useEffect(() => {
    if (searchParams.get("compose") === "1") {
      setOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!nomorUrut.trim()) {
      setNomorUrut(nextNomorUrut);
    }
  }, [nextNomorUrut, nomorUrut]);

  useEffect(() => {
    if (!targetPositions.some((position) => position.value === targetPositionId)) {
      setTargetPositionId(targetPositions[0]?.value ?? "");
    }
  }, [targetPositionId, targetPositions]);

  useEffect(() => {
    if (!availableTargetUsers.some((user) => user.id === targetUserId)) {
      setTargetUserId(availableTargetUsers[0]?.id ?? "");
    }
  }, [availableTargetUsers, targetUserId]);

  if (!canRegister) {
    return null;
  }

  return (
    <Card className="border-border/90">
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <CardTitle className="flex items-center gap-2">
            <FilePlus2 className="h-5 w-5 text-primary" />
            Tambah Surat {defaultType === "masuk" ? "Masuk" : "Keluar"}
          </CardTitle>
          <CardDescription>
            Upload PDF di bagian atas, deteksi AI bila diperlukan, lalu verifikasi draft sebelum menyimpan. Surat yang
            tersimpan langsung masuk ke antrian disposisi dengan status Menunggu Tindak Lanjut.
          </CardDescription>
        </div>
        <Button type="button" variant={open ? "outline" : "default"} onClick={() => setOpen((value) => !value)}>
          {open ? "Tutup Form" : `Tambah Surat ${defaultType === "masuk" ? "Masuk" : "Keluar"}`}
        </Button>
      </CardHeader>

      {open ? (
        <CardContent className="space-y-5">
          <div className="rounded-[1.35rem] border border-border bg-card/80 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Upload PDF Surat</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Maksimal 100MB. File dioptimalkan di sisi klien agar tetap ringan dan tetap terbaca jelas.
                </p>
              </div>
              {uploadedPdf ? <Badge variant="outline">{uploadedPdf.fileSizeMb} MB</Badge> : null}
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto]">
              <div className="space-y-3">
                <Input
                  type="file"
                  accept="application/pdf"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;

                    setFormError("");
                    setFeedback("");
                    setDraftFeedback("");
                    setIsUploadingPdf(true);

                    try {
                      const processedPdf = await processPdfUpload(file);
                      setUploadedPdf(processedPdf);
                    } catch (error) {
                      setUploadedPdf(null);
                      setFormError(error instanceof Error ? error.message : "PDF tidak dapat diproses.");
                    } finally {
                      setIsUploadingPdf(false);
                    }
                  }}
                />
                {uploadedPdf ? (
                  <div className="rounded-xl border border-border bg-muted/35 px-4 py-3 text-sm text-muted-foreground">
                    <p className="font-semibold text-foreground">{uploadedPdf.fileName}</p>
                    {isAdmin ? <p className="mt-1">{uploadedPdf.compressionNote}</p> : null}
                    {uploadedPdf.isImageBased ? (
                      <p className="mt-2 font-medium text-amber-700">
                        PDF ini terdeteksi sebagai scan gambar — tidak ada teks yang terbaca. OCR diperlukan sebelum deteksi metadata dapat dijalankan.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {aiConfig.enabled && uploadedPdf ? (
                <div className="rounded-[1.15rem] border border-primary/20 bg-primary/5 p-3">
                  <AletaAIMark label="Deteksi metadata draft surat" />
                  {!draftMetadataEnabled ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Fitur ini sedang dinonaktifkan oleh administrator.
                    </p>
                  ) : uploadedPdf.isImageBased ? (
                    <div className="mt-3 rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                      <p className="font-semibold">File memerlukan OCR</p>
                      <p className="mt-1 leading-6">PDF ini berupa scan gambar dan tidak dapat diproses untuk deteksi metadata. Silakan konversi ke teks terlebih dahulu.</p>
                    </div>
                  ) : (
                  <Button
                    type="button"
                    className="mt-3 w-full"
                    disabled={isUploadingPdf || isDetectingAI}
                    onClick={async () => {
                      setIsDetectingAI(true);
                      setFormError("");
                      setFeedback("");

                      try {
                        if (!currentUser) {
                          throw new Error("Sesi pengguna tidak ditemukan. Silakan login ulang.");
                        }

                        const response = await fetch("/api/ai/extract-surat", {
                          method: "POST",
                          headers: {
                            "content-type": "application/json",
                          },
                          body: JSON.stringify({
                            type: defaultType,
                            extractedText: uploadedPdf.extractedText,
                          }),
                        });
                        const { payload, rawText } = await readJsonResponseSafe<{
                          ok?: boolean;
                          data?: {
                            draft: {
                              nomorSurat: string;
                              nomorUrut?: string;
                              tanggalSurat?: string;
                              tanggalAdministratif?: string;
                              pengirim: string;
                              perihal: string;
                              assignedUnit: string;
                              confidentiality: LetterDetail["confidentiality"];
                              asalSurat: string;
                              tujuanSurat: string;
                              kodeKlasifikasi: string;
                              klasifikasi: string;
                              klasifikasiTags?: string[];
                              ringkasan: string;
                              tags: string[];
                              suggestedTargetPositionId?: string;
                              suggestedTargetUserId?: string;
                              aiReviewNote: string;
                            };
                          };
                          error?: { message?: string };
                        }>(response);

                        const detectedDraft = payload?.data?.draft;

                        if (!response.ok || !payload?.ok || !detectedDraft) {
                          throw new Error(
                            payload?.error?.message ??
                              summarizePlainTextError(rawText, "Deteksi AI tidak dapat dijalankan.")
                          );
                        }

                        const draft = detectedDraft;
                        const detectedClassification = getClassificationOptionByValue(draft.kodeKlasifikasi);

                        setDraftMode("ai");
                        setNomorUrut((current) => current || draft.nomorUrut || nextNomorUrut);
                        setNomorSurat((current) => current || draft.nomorSurat);
                        setTanggalSurat((current) => draft.tanggalSurat || current);
                        setTanggalAdministratif((current) => draft.tanggalAdministratif || current);
                        setPengirim(draft.pengirim);
                        setPerihal(draft.perihal);
                        setAssignedUnit(draft.assignedUnit);
                        setConfidentiality(draft.confidentiality);
                        setAsalSurat(draft.asalSurat);
                        setTujuanSurat(draft.tujuanSurat);
                        setKodeKlasifikasi(draft.kodeKlasifikasi);
                        setKlasifikasi(detectedClassification ? getClassificationTitle(detectedClassification) : draft.klasifikasi);
                        setKlasifikasiTags(
                          Array.from(
                            new Set([
                              ...(detectedClassification
                                ? [detectedClassification.label, detectedClassification.category]
                                : []),
                              ...(draft.klasifikasiTags ?? []),
                            ])
                          )
                        );
                        setRingkasan(draft.ringkasan);
                        setTags(draft.tags);
                        setTargetPositionId(draft.suggestedTargetPositionId || targetPositions[0]?.value || "");
                        setTargetUserId(draft.suggestedTargetUserId ?? "");
                        setDraftFeedback(draft.aiReviewNote);
                      } catch (error) {
                        setFormError(error instanceof Error ? error.message : "Deteksi AI tidak dapat dijalankan.");
                      } finally {
                        setIsDetectingAI(false);
                      }
                    }}
                  >
                    {isDetectingAI ? "Mendeteksi..." : "Deteksi AI"}
                  </Button>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {isAdmin && draftFeedback ? (
            <div className="rounded-[1.2rem] border border-sky-300/60 bg-sky-500/10 px-4 py-3 text-sm text-sky-800 dark:text-sky-200">
              {draftFeedback}
            </div>
          ) : null}

          {formError ? (
            <div className="rounded-[1.2rem] border border-rose-300/60 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-200">
              {formError}
            </div>
          ) : null}

          <div className="grid gap-5 lg:grid-cols-4">
            <Field label="Nomor Urut" required>
              <Input value={nomorUrut} onChange={(event) => setNomorUrut(event.target.value)} className="h-12 text-base" />
            </Field>
            <Field label="Nomor Surat" required>
              <Input value={nomorSurat} onChange={(event) => setNomorSurat(event.target.value)} className="h-12 text-base" />
            </Field>
            <Field label="Tanggal Surat" required>
              <Input
                type="date"
                value={tanggalSurat}
                onChange={(event) => setTanggalSurat(event.target.value)}
                className="h-12 text-base"
              />
            </Field>
            <Field label={defaultType === "masuk" ? "Tanggal Terima" : "Tanggal Kirim"} required>
              <Input
                type="date"
                value={tanggalAdministratif}
                onChange={(event) => setTanggalAdministratif(event.target.value)}
                className="h-12 text-base"
              />
            </Field>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Field label={defaultType === "masuk" ? "Pengirim Surat" : "Unit Pengirim"} required>
              <Input value={pengirim} onChange={(event) => setPengirim(event.target.value)} className="h-12 text-base" />
            </Field>
            <Field label="Perihal" required>
              <Input value={perihal} onChange={(event) => setPerihal(event.target.value)} className="h-12 text-base" />
            </Field>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <Field label="Unit Terkait" required>
              <CreatableMultiSelect
                multiple={false}
                value={assignedUnit ? [assignedUnit] : []}
                onChange={(values) => setAssignedUnit(values[0] ?? "")}
                options={unitOptions}
                placeholder="Pilih atau buat unit terkait"
              />
            </Field>
            <Field label="Kerahasiaan" required>
              <CreatableMultiSelect
                multiple={false}
                allowCreate={false}
                value={confidentiality ? [confidentiality] : []}
                onChange={(values) => setConfidentiality((values[0] as LetterDetail["confidentiality"]) ?? "Penting")}
                options={confidentialityOptions}
                placeholder="Pilih kerahasiaan"
              />
            </Field>
            <Field label="Mode Viewer" required>
              <CreatableMultiSelect
                multiple={false}
                allowCreate={false}
                value={viewerMode ? [viewerMode] : []}
                onChange={(values) => setViewerMode((values[0] as LetterDetail["viewerMode"]) ?? "download")}
                options={viewerOptions}
                placeholder="Pilih mode viewer"
              />
            </Field>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Field label="Asal Surat" required>
              <CreatableMultiSelect
                multiple={false}
                value={asalSurat ? [asalSurat] : []}
                onChange={(values) => setAsalSurat(values[0] ?? "")}
                options={originOptions}
                placeholder="Pilih asal surat atau tulis manual"
              />
            </Field>
            <Field label="Tujuan Surat" required>
              <Input value={tujuanSurat} onChange={(event) => setTujuanSurat(event.target.value)} className="h-12 text-base" />
            </Field>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Field label="Kode Klasifikasi" required>
              <CreatableMultiSelect
                multiple={false}
                value={kodeKlasifikasi ? [kodeKlasifikasi] : []}
                onChange={(values) => {
                  const nextValue = values[0] ?? "";
                  const matched = getClassificationOptionByValue(nextValue);

                  setKodeKlasifikasi(nextValue);
                  if (matched) {
                    setKlasifikasi(getClassificationTitle(matched));
                    setKlasifikasiTags((current) =>
                      Array.from(new Set([matched.label, matched.category, ...current])).slice(0, 5)
                    );
                  }
                }}
                options={letterClassificationOptions}
                placeholder="Cari kode klasifikasi resmi MA atau biarkan kosong"
              />
            </Field>
            <Field label="Klasifikasi Surat">
              <CreatableMultiSelect
                multiple={false}
                value={klasifikasi ? [klasifikasi] : []}
                onChange={(values) => setKlasifikasi(values[0] ?? "")}
                options={letterClassificationLabelOptions}
                placeholder="Pilih klasifikasi resmi atau isi manual bila perlu"
              />
            </Field>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <Field label="Tag Klasifikasi">
              <CreatableMultiSelect
                value={klasifikasiTags}
                onChange={setKlasifikasiTags}
                options={[
                  ...letterClassificationOptions,
                  ...classificationCategoryOptions,
                ]}
                placeholder="Tambahkan tag klasifikasi"
              />
            </Field>
            <Field label="Tag Surat">
              <CreatableMultiSelect
                value={tags}
                onChange={setTags}
                options={tagSeedOptions}
                placeholder="Pilih atau buat tag surat"
              />
            </Field>
            <Field label="Lampiran">
              <CreatableMultiSelect
                value={lampiran}
                onChange={setLampiran}
                options={[
                  { value: "jadwal-verifikasi.pdf" },
                  { value: "pedoman-sarpras.pdf" },
                  { value: "rekap-template.xlsx" },
                ]}
                placeholder="Tambahkan lampiran"
              />
            </Field>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Field label="Jabatan Tujuan" required>
              <CreatableMultiSelect
                multiple={false}
                allowCreate={false}
                value={targetPositionId ? [targetPositionId] : []}
                onChange={(values) => setTargetPositionId(values[0] ?? "")}
                options={targetPositions}
                placeholder="Pilih jabatan tujuan"
              />
            </Field>
            <Field label="Nama Pejabat" required>
              <CreatableMultiSelect
                multiple={false}
                allowCreate={false}
                value={targetUserId ? [targetUserId] : []}
                onChange={(values) => setTargetUserId(values[0] ?? "")}
                options={availableTargetUsers.map((user) => ({
                  value: user.id,
                  label: `${user.name} - ${getUserPositionLabel(user)}`,
                }))}
                placeholder="Pilih pejabat tujuan"
              />
            </Field>
          </div>

          <Field label="Ringkasan / Isi Inti Surat" required>
            <Textarea value={ringkasan} onChange={(event) => setRingkasan(event.target.value)} className="min-h-[140px] text-base" />
          </Field>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.3rem] border border-dashed border-primary/30 bg-primary/5 p-4">
            <div className="space-y-1">
              <p className="font-semibold text-foreground">Verify-before-save</p>
              <p className="text-sm text-muted-foreground">
                {draftMode === "ai"
                  ? "Draft hasil AI sudah mengisi form. Tinjau dan koreksi bila perlu sebelum disimpan."
                  : "Form manual tetap aktif. Anda bisa mengisi sendiri atau memulai dari Deteksi AI."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={resetForm}>
                Reset Draft
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  if (
                    !nomorUrut.trim() ||
                    !nomorSurat.trim() ||
                    !tanggalSurat.trim() ||
                    !tanggalAdministratif.trim() ||
                    !pengirim.trim() ||
                    !perihal.trim() ||
                    !assignedUnit.trim() ||
                    !asalSurat.trim() ||
                    !tujuanSurat.trim() ||
                    !ringkasan.trim() ||
                    !targetPositionId ||
                    !targetUserId
                  ) {
                    setFeedback("");
                    setFormError("Lengkapi seluruh metadata wajib sebelum menyimpan surat.");
                    return;
                  }

                  setIsUploadingPdf(true); // Reuse loading state for submission
                  const result = await createLetter({
                    type: defaultType,
                    nomorUrut: nomorUrut.trim(),
                    nomorSurat: nomorSurat.trim(),
                    tanggal: new Date(`${tanggalSurat}T08:00:00`).toISOString(),
                    tanggalAdministratif: new Date(`${tanggalAdministratif}T08:00:00`).toISOString(),
                    pengirim: pengirim.trim(),
                    perihal: perihal.trim(),
                    assignedUnit: assignedUnit.trim(),
                    confidentiality,
                    kodeKlasifikasi: kodeKlasifikasi.trim(),
                    klasifikasiTags,
                    ringkasan: ringkasan.trim(),
                    asalSurat: asalSurat.trim(),
                    tujuanSurat: tujuanSurat.trim(),
                    klasifikasi: klasifikasi.trim(),
                    lampiran,
                    tags,
                    viewerMode,
                    targetPositionId,
                    targetUserId,
                    documentFileName: uploadedPdf?.fileName,
                    documentSizeMb: uploadedPdf?.fileSizeMb,
                    documentTextExtract: uploadedPdf?.extractedText,
                    documentFile: uploadedPdf?.optimizedFile,
                    aiGenerated: draftMode === "ai",
                  });
                  setIsUploadingPdf(false);

                  if (result.ok) {
                    setFormError("");
                    setFeedback(result.message);
                    resetForm();
                  } else {
                    setFeedback("");
                    setFormError(result.message);
                  }
                }}
              >
                <Send className="h-4 w-4" />
                Konfirmasi & Simpan
              </Button>
            </div>
          </div>
        </CardContent>
      ) : null}

      {feedback ? (
        <div className="px-6 pb-6">
          <div className="rounded-[1.2rem] border border-emerald-300/60 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
            {feedback}
          </div>
        </div>
      ) : null}

      {isUploadingPdf ? (
        <div className="px-6 pb-6">
          <div className="rounded-[1.2rem] border border-border bg-muted/35 px-4 py-3 text-sm text-muted-foreground">
            Memproses PDF dan menyiapkan draft dokumen...
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-foreground">
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </label>
      {children}
    </div>
  );
}
