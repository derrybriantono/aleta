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
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { usePortal } from "@/lib/app-state";
import { apiPath } from "@/lib/base-path";
import {
  getClassificationOptionByValue,
  getClassificationTitle,
  letterClassificationCatalog,
  letterClassificationLabelOptions,
  letterClassificationOptions,
  letterOriginSuggestions,
} from "@/lib/letter-taxonomy";
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
import { type LetterDetail, type LetterTemplate } from "@/lib/types";

const confidentialityOptions = ["Biasa", "Penting", "Rahasia"].map((value) => ({ value }));
const viewerOptions = [
  { value: "download", label: "Boleh Diunduh" },
  { value: "preview", label: "Hanya Dilihat" },
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

function renderLetterTemplatePreview(template: LetterTemplate, values: Record<string, string>) {
  return template.body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => values[key] || `{{${key}}}`);
}

export function LetterRegistrationPanel({
  defaultType,
  onCreated,
}: {
  defaultType: LetterDetail["type"];
  onCreated?: () => void;
}) {
  const searchParams = useSearchParams();
  const { aiConfig, createLetter, currentUser, getUsersByPosition, positions, activeUsers: users } = usePortal();
  const currentPosition = getEffectivePosition(currentUser, positions);
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
  const [aiSuggestionNotice, setAiSuggestionNotice] = useState("");
  const [isAiSuggesting, setIsAiSuggesting] = useState(false);
  const [viewerMode, setViewerMode] = useState<LetterDetail["viewerMode"]>("download");
  const [targetPositionId, setTargetPositionId] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [letterTemplates, setLetterTemplates] = useState<LetterTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [feedback, setFeedback] = useState("");
  const [draftFeedback, setDraftFeedback] = useState("");
  const [formError, setFormError] = useState("");
  const unitOptions = useMemo(
    () => [...new Set(positions.map((position) => position.unitKerja))].map((value) => ({ value })),
    [positions]
  );
  const originOptions = useMemo(
    () => letterOriginSuggestions.map((value) => ({ value })),
    []
  );
  const incomingTargetUsers = useMemo(() => getLeadershipRecipients(users, positions), [positions, users]);
  const targetPositions = useMemo(() => {
    if (defaultType === "masuk") {
      return positions
        .filter((position) => ["pos-ketua", "pos-wakil"].includes(position.id))
        .map((position) => ({ value: position.id, label: `${position.name} - ${position.unitKerja}` }));
    }

    return positions
      .filter((position) => position.id !== currentPositionId && getPositionUsers(position.id, users).length > 0)
      .map((position) => ({ value: position.id, label: `${position.name} - ${position.unitKerja}` }));
  }, [currentPositionId, defaultType, positions, users]);
  const availableTargetUsers = useMemo(() => {
    if (!targetPositionId) {
      return defaultType === "masuk" ? incomingTargetUsers : [];
    }

    return getUsersByPosition(targetPositionId);
  }, [defaultType, getUsersByPosition, incomingTargetUsers, targetPositionId]);
  const selectedTemplate = useMemo(
    () => letterTemplates.find((template) => template.id === selectedTemplateId) ?? null,
    [letterTemplates, selectedTemplateId]
  );
  const selectedTemplatePreview = useMemo(() => {
    if (!selectedTemplate) return "";
    return renderLetterTemplatePreview(selectedTemplate, {
      nomor_surat: nomorSurat || "W19-A6/001/HK.05/I/2026",
      tanggal_surat: tanggalSurat || todayValue(),
      tujuan: tujuanSurat || "Pengadilan Tinggi Agama",
      perihal: perihal || "Permintaan Data",
      nama_pengadilan: "Pengadilan Agama Donggala",
      alamat_pengadilan: "Jl. Vatu Bala, Donggala",
      nama_penandatangan: currentUser?.name ?? "Pejabat Penandatangan",
      jabatan_penandatangan: getUserPositionLabel(currentUser, positions),
    });
  }, [currentUser, nomorSurat, perihal, positions, selectedTemplate, tanggalSurat, tujuanSurat]);

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
    setAiSuggestionNotice("");
    setViewerMode("download");
    setUploadedPdf(null);
    setDraftFeedback("");
    setFormError("");
  };

  const requestClassificationSuggestion = async () => {
    setIsAiSuggesting(true);
    setAiSuggestionNotice("");
    try {
      const response = await fetch(apiPath("/api/ai/letters/classification-suggestion"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          perihal,
          asalTujuan: defaultType === "masuk" ? asalSurat : tujuanSurat,
          ringkasanIsi: ringkasan,
          type: defaultType,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; data?: { suggestedClassificationCode?: string; suggestedClassificationLabel?: string; suggestedTags?: string[]; reason?: string; message?: string }; error?: { message?: string } }
        | null;
      if (!response.ok || !payload?.ok || !payload.data) {
        throw new Error(payload?.error?.message ?? "Saran AI belum dapat diproses.");
      }
      const suggestion = payload.data;
      if (suggestion.suggestedClassificationCode) {
        setKodeKlasifikasi(suggestion.suggestedClassificationCode);
      }
      if (suggestion.suggestedClassificationLabel) {
        const option = getClassificationOptionByValue(suggestion.suggestedClassificationCode || "");
        setKlasifikasi(option ? getClassificationTitle(option) : suggestion.suggestedClassificationLabel);
      }
      if (suggestion.suggestedTags?.length) {
        setKlasifikasiTags((current) => Array.from(new Set([...suggestion.suggestedTags!, ...current])).slice(0, 8));
      }
      setAiSuggestionNotice(suggestion.reason || suggestion.message || "Saran klasifikasi AI sudah diterapkan sebagai data awal.");
    } catch (error) {
      setAiSuggestionNotice(error instanceof Error ? error.message : "Saran AI belum tersedia.");
    } finally {
      setIsAiSuggesting(false);
    }
  };

  const requestSummarySuggestion = async () => {
    setIsAiSuggesting(true);
    setAiSuggestionNotice("");
    try {
      const response = await fetch(apiPath("/api/ai/letters/summary-suggestion"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ perihal, isiRingkas: ringkasan }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; data?: { summary?: string; message?: string }; error?: { message?: string } }
        | null;
      if (!response.ok || !payload?.ok || !payload.data) {
        throw new Error(payload?.error?.message ?? "Ringkasan AI belum dapat diproses.");
      }
      if (payload.data.summary && !payload.data.summary.startsWith("Belum ada teks")) {
        setRingkasan(payload.data.summary);
      }
      setAiSuggestionNotice(payload.data.message || "Ringkasan AI sudah diterapkan sebagai data awal.");
    } catch (error) {
      setAiSuggestionNotice(error instanceof Error ? error.message : "Ringkasan AI belum tersedia.");
    } finally {
      setIsAiSuggesting(false);
    }
  };

  useEffect(() => {
    if (searchParams.get("compose") === "1") {
      const timer = window.setTimeout(() => {
        setOpen(true);
      }, 0);

      return () => window.clearTimeout(timer);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!targetPositions.some((position) => position.value === targetPositionId)) {
      const timer = window.setTimeout(() => {
        setTargetPositionId(targetPositions[0]?.value ?? "");
      }, 0);

      return () => window.clearTimeout(timer);
    }
  }, [targetPositionId, targetPositions]);

  useEffect(() => {
    if (defaultType !== "keluar" || !canRegister) return;
    let cancelled = false;

    const loadTemplates = async () => {
      try {
        const response = await fetch(apiPath("/api/surat/templates?activeOnly=true"), {
          credentials: "include",
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; data?: { items?: LetterTemplate[] } }
          | null;
        if (!cancelled && response.ok && payload?.ok) {
          const items = payload.data?.items ?? [];
          setLetterTemplates(items);
          setSelectedTemplateId((current) => current || items[0]?.id || "");
        }
      } catch {
        if (!cancelled) setLetterTemplates([]);
      }
    };

    void loadTemplates();
    return () => {
      cancelled = true;
    };
  }, [canRegister, defaultType]);

  useEffect(() => {
    if (!availableTargetUsers.some((user) => user.id === targetUserId)) {
      const timer = window.setTimeout(() => {
        setTargetUserId(availableTargetUsers[0]?.id ?? "");
      }, 0);

      return () => window.clearTimeout(timer);
    }
  }, [availableTargetUsers, targetUserId]);

  if (!canRegister) {
    return null;
  }

  return (
    <Card className="border-border/90">
      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <CardTitle className="flex items-center gap-2">
            <FilePlus2 className="h-5 w-5 text-primary" />
            Tambah Surat {defaultType === "masuk" ? "Masuk" : "Keluar"}
          </CardTitle>
          <CardDescription>
            Unggah PDF di bagian atas, gunakan bantuan AI bila diperlukan, lalu cek kembali sebelum menyimpan. Surat yang
            tersimpan langsung masuk ke daftar tindak lanjut.
          </CardDescription>
        </div>
        <Button
          type="button"
          variant={open ? "outline" : "default"}
          className="w-full sm:w-auto"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Tutup Formulir" : `Tambah Surat ${defaultType === "masuk" ? "Masuk" : "Keluar"}`}
        </Button>
      </CardHeader>

      {open ? (
        <CardContent className="space-y-5">
          <div className="rounded-[1.35rem] border border-border bg-card/80 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Unggah PDF Surat</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Maksimal 100MB. File akan diringankan sebelum disimpan agar tetap mudah dibuka.
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
                        PDF ini berupa gambar, jadi teksnya belum terbaca. Ubah ke PDF teks dulu bila ingin memakai bantuan AI.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {aiConfig.enabled && uploadedPdf ? (
                <div className="rounded-[1.15rem] border border-primary/20 bg-primary/5 p-3">
                  <AletaAIMark label="Bantu isi data surat" />
                  {!draftMetadataEnabled ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Fitur ini sedang dinonaktifkan oleh administrator.
                    </p>
                  ) : uploadedPdf.isImageBased ? (
                    <div className="mt-3 rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                      <p className="font-semibold">Teks PDF belum terbaca</p>
                      <p className="mt-1 leading-6">PDF ini berupa gambar. Ubah ke PDF teks dulu agar bantuan AI bisa membaca isinya.</p>
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
                          throw new Error("Data login tidak ditemukan. Silakan login ulang.");
                        }

                        const response = await fetch(apiPath("/api/ai/extract-surat"), {
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
                              summarizePlainTextError(rawText, "Bantuan AI belum dapat dijalankan.")
                          );
                        }

                        const draft = detectedDraft;
                        const detectedClassification = getClassificationOptionByValue(draft.kodeKlasifikasi);

                        setDraftMode("ai");
                        setNomorUrut((current) => current || draft.nomorUrut || "");
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
                        setFormError(error instanceof Error ? error.message : "Bantuan AI belum dapat dijalankan.");
                      } finally {
                        setIsDetectingAI(false);
                      }
                    }}
                  >
                    {isDetectingAI ? "Membaca..." : "Isi dengan Bantuan AI"}
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

          {defaultType === "keluar" && letterTemplates.length > 0 ? (
            <div className="rounded-[1.2rem] border border-border bg-muted/25 p-4">
              <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
                <Field label="Contoh Format Surat Keluar">
                  <NativeSelect
                    value={selectedTemplateId}
                    onChange={(event) => setSelectedTemplateId(event.target.value)}
                    className="h-12 text-base"
                  >
                    {letterTemplates.map((template) => (
                      <option key={template.id} value={template.id}>{template.name}</option>
                    ))}
                  </NativeSelect>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Format ini hanya membantu melihat contoh isi surat. Data resmi tetap diisi di bawah.
                  </p>
                </Field>
                <div className="min-w-0 rounded-xl border border-border bg-card p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">Contoh Isi Surat</p>
                    {selectedTemplate ? <Badge variant="outline">{selectedTemplate.placeholders.length} kolom isian</Badge> : null}
                  </div>
                  <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                    {selectedTemplatePreview || "Pilih format untuk melihat contoh isi surat."}
                  </pre>
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid gap-5 lg:grid-cols-4">
            <Field label="Nomor Agenda">
              <Input
                value={nomorUrut}
                onChange={(event) => setNomorUrut(event.target.value)}
                placeholder="Kosongkan untuk nomor otomatis"
                className="h-12 text-base"
              />
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Jika dikosongkan, sistem membuat nomor agenda otomatis per jenis surat dan tahun.
              </p>
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
            <Field label="Akses File" required>
              <CreatableMultiSelect
                multiple={false}
                allowCreate={false}
                value={viewerMode ? [viewerMode] : []}
                onChange={(values) => setViewerMode((values[0] as LetterDetail["viewerMode"]) ?? "download")}
                options={viewerOptions}
                placeholder="Pilih akses file"
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

          <div className="rounded-[1.2rem] border border-border bg-muted/25 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Bantuan AI Administrasi</p>
                <p className="mt-1 text-xs text-muted-foreground">Hasil AI hanya saran awal dan tidak otomatis disimpan sebelum Anda menekan tombol simpan.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => void requestClassificationSuggestion()} disabled={isAiSuggesting || !perihal.trim()}>
                  Minta Saran AI
                </Button>
                <Button type="button" variant="outline" onClick={() => void requestSummarySuggestion()} disabled={isAiSuggesting || (!perihal.trim() && !ringkasan.trim())}>
                  Buat Ringkasan AI
                </Button>
              </div>
            </div>
            {aiSuggestionNotice ? <p className="mt-3 text-xs leading-5 text-muted-foreground">{aiSuggestionNotice}</p> : null}
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
            <Field label="Penanda Klasifikasi">
              <CreatableMultiSelect
                value={klasifikasiTags}
                onChange={setKlasifikasiTags}
                options={[
                  ...letterClassificationOptions,
                  ...classificationCategoryOptions,
                ]}
                placeholder="Tambahkan penanda klasifikasi"
              />
            </Field>
            <Field label="Penanda Surat">
              <CreatableMultiSelect
                value={tags}
                onChange={setTags}
                options={tagSeedOptions}
                placeholder="Pilih atau buat penanda surat"
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
                  label: `${user.name} - ${getUserPositionLabel(user, positions)}`,
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
              <p className="font-semibold text-foreground">Cek sebelum simpan</p>
              <p className="text-sm text-muted-foreground">
                {draftMode === "ai"
                  ? "Bantuan AI sudah mengisi formulir. Tinjau dan koreksi bila perlu sebelum disimpan."
                  : "Formulir manual tetap aktif. Anda bisa mengisi sendiri atau memakai bantuan AI."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={resetForm}>
                Kosongkan Formulir
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  if (
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
                    setFormError("Lengkapi seluruh data wajib sebelum menyimpan surat.");
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
                    onCreated?.();
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
            Memproses PDF dan menyiapkan data awal...
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
