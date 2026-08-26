"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CalendarCheck2,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  FileText,
  LoaderCircle,
  LogIn,
  MessageCircle,
  Send,
  UploadCloud,
} from "lucide-react";
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";

import { AletaLogo } from "@/components/branding/aleta-logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { apiPath, withBasePath } from "@/lib/base-path";
import type {
  HrPublicFormSettingsDto,
  HrPublicFormType,
  HrPublicEmployeeLookupDto,
  HrLeaveDailyImpactDto,
  HrPublicMeetingResultDto,
  HrPublicOptionsDto,
  HrPublicStatusDto,
  HrPublicSubmissionResultDto,
} from "@/lib/e-kepegawaian-types";

type PublicServiceId = HrPublicFormType | "cek-status" | "agenda-rapat";
type LookupField = "identifier" | "name" | "contact";

type InstitutionPublicInfo = {
  courtName?: string;
  courtShortName?: string;
  logoUrl?: string;
  mobilePhone?: string;
  csWhatsappNumber?: string;
  botWhatsappNumber?: string;
  email?: string;
  website?: string;
};

type ApiEnvelope<T> = {
  ok?: boolean;
  data?: T;
  error?: { message?: string };
};

type PublicFormState = {
  identifier: string;
  name: string;
  contact: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason: string;
  addressDuringLeave: string;
  title: string;
  periodYear: string;
  periodMonth: string;
  submissionDate: string;
  description: string;
  requestDate: string;
  scheduledTime: string;
  actualTime: string;
};

type StatusFormState = {
  ticketCode: string;
  verifier: string;
};

const today = new Date().toISOString().slice(0, 10);

const initialFormState: PublicFormState = {
  identifier: "",
  name: "",
  contact: "",
  leaveTypeId: "",
  startDate: today,
  endDate: today,
  reason: "",
  addressDuringLeave: "",
  title: "",
  periodYear: String(new Date().getFullYear()),
  periodMonth: "",
  submissionDate: today,
  description: "",
  requestDate: today,
  scheduledTime: "",
  actualTime: "",
};

const serviceConfigs: Array<{
  id: PublicServiceId;
  title: string;
  shortTitle: string;
  description: string;
  icon: typeof CalendarCheck2;
  methodLabel: string;
}> = [
  {
    id: "cuti",
    title: "Permohonan Cuti",
    shortTitle: "Cuti",
    description: "Ajukan cuti tanpa login memakai identitas pegawai yang sudah tercatat.",
    icon: CalendarCheck2,
    methodLabel: "Form publik cuti",
  },
  {
    id: "upload-pck",
    title: "Penyetoran PCK",
    shortTitle: "PCK",
    description: "Setor dokumen PCK kepada kepegawaian untuk diverifikasi.",
    icon: UploadCloud,
    methodLabel: "Upload PCK",
  },
  {
    id: "upload-skp",
    title: "Penyetoran SKP",
    shortTitle: "SKP",
    description: "Unggah SKP periodik tanpa perlu masuk ke portal internal.",
    icon: FileCheck2,
    methodLabel: "Upload SKP",
  },
  {
    id: "wfa",
    title: "Laporan WFA",
    shortTitle: "WFA",
    description: "Kirim laporan kerja WFA dengan ringkasan kegiatan dan lampiran bila ada.",
    icon: ClipboardCheck,
    methodLabel: "Laporan WFA",
  },
  {
    id: "lambat-datang",
    title: "Permohonan Lambat Datang",
    shortTitle: "Lambat Datang",
    description: "Ajukan izin keterlambatan dengan waktu jadwal dan waktu realisasi.",
    icon: Clock3,
    methodLabel: "Izin lambat datang",
  },
  {
    id: "cepat-pulang",
    title: "Permohonan Pulang Cepat",
    shortTitle: "Pulang Cepat",
    description: "Ajukan izin pulang cepat beserta alasan dan waktu pulang.",
    icon: Clock3,
    methodLabel: "Izin pulang cepat",
  },
  {
    id: "cek-status",
    title: "Cek Status Pengajuan",
    shortTitle: "Cek Status",
    description: "Pantau pengajuan publik memakai kode tiket dan NIP/NIK atau nomor HP.",
    icon: CheckCircle2,
    methodLabel: "Cek status tiket",
  },
  {
    id: "agenda-rapat",
    title: "Agenda dan Hasil Rapat",
    shortTitle: "Agenda Rapat",
    description: "Lihat agenda atau hasil rapat yang ditandai publik oleh admin E-Kepegawaian.",
    icon: FileText,
    methodLabel: "Agenda/Hasil rapat",
  },
];

function normalizeWhatsappNumber(value = "") {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits;
}

function formSettingKey(serviceId: HrPublicFormType): keyof HrPublicFormSettingsDto {
  if (serviceId === "upload-pck") return "uploadPck";
  if (serviceId === "upload-skp") return "uploadSkp";
  if (serviceId === "lambat-datang") return "lambatDatang";
  if (serviceId === "cepat-pulang") return "cepatPulang";
  return serviceId;
}

function isFormService(serviceId: PublicServiceId): serviceId is HrPublicFormType {
  return serviceId !== "cek-status" && serviceId !== "agenda-rapat";
}

function getServiceConfig(serviceId: string | undefined) {
  return serviceConfigs.find((item) => item.id === serviceId) ?? null;
}

function isKnownService(serviceId: string | undefined): serviceId is PublicServiceId {
  return Boolean(getServiceConfig(serviceId));
}

function servicePath(serviceId?: PublicServiceId) {
  return serviceId ? `/public/e-kepegawaian/${serviceId}` : "/public/e-kepegawaian";
}

function safeMonthLabel(value: string) {
  const month = Number(value);
  if (!month) return "Tidak ditentukan";
  return new Intl.DateTimeFormat("id-ID", { month: "long" }).format(new Date(2026, month - 1, 1));
}

function formatDate(value: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`));
}

function formatDays(value: number) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(value);
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(value)}%`;
}

async function readJson<T>(response: Response): Promise<ApiEnvelope<T>> {
  return (await response.json().catch(() => ({}))) as ApiEnvelope<T>;
}

function displayValue(value: string, fallback: string) {
  const cleanValue = value.trim();
  return cleanValue || fallback;
}

function buildCutiWhatsappMessage(form: PublicFormState, leaveTypeName: string, url: string) {
  return [
    "MODE: EKEPEGAWAIAN_PERMOHONAN_CUTI",
    "Assalamu'alaikum.",
    "Saya ingin mengajukan permohonan cuti melalui E-Kepegawaian ALETA.",
    "",
    `Nama: ${displayValue(form.name, "[isi nama lengkap]")}`,
    `NIP/NIK/Nomor Pegawai: ${displayValue(form.identifier, "[isi NIP/NIK/nomor pegawai]")}`,
    `Nomor HP: ${displayValue(form.contact, "[isi nomor HP aktif]")}`,
    `Jenis Cuti: ${displayValue(leaveTypeName, "[pilih jenis cuti]")}`,
    `Tanggal Mulai: ${displayValue(form.startDate, "[YYYY-MM-DD]")}`,
    `Tanggal Selesai: ${displayValue(form.endDate, "[YYYY-MM-DD]")}`,
    `Alasan: ${displayValue(form.reason, "[isi alasan singkat]")}`,
    `Alamat Selama Cuti: ${displayValue(form.addressDuringLeave, "[isi alamat selama cuti]")}`,
    "",
    `Tautan form ALETA: ${url}`,
    "Mohon petunjuk apabila ada data/lampiran yang perlu dilengkapi.",
  ].join("\n");
}

function buildWhatsappMessage(serviceId: PublicServiceId | undefined, serviceTitle: string, url: string, form: PublicFormState, leaveTypeName: string) {
  if (serviceId === "cuti") {
    return buildCutiWhatsappMessage(form, leaveTypeName, url);
  }

  return [
    "Assalamu'alaikum.",
    `Saya ingin menggunakan layanan ${serviceTitle} E-Kepegawaian ALETA tanpa login.`,
    `Tautan layanan: ${url}`,
    "Mohon panduan bila data pegawai saya belum cocok.",
  ].join("\n");
}

function hideGlobalAutoformLoading() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("aleta:hide-loading"));
  }
}

export function EKepegawaianPublicPanel({ initialService }: { initialService?: string }) {
  const selectedService = isKnownService(initialService) ? initialService : undefined;
  const selectedConfig = getServiceConfig(selectedService);
  const isCutiWhatsappMode = selectedService === "cuti";
  const [options, setOptions] = useState<HrPublicOptionsDto | null>(null);
  const [institution, setInstitution] = useState<InstitutionPublicInfo>({});
  const [form, setForm] = useState<PublicFormState>(initialFormState);
  const [statusForm, setStatusForm] = useState<StatusFormState>({ ticketCode: "", verifier: "" });
  const [file, setFile] = useState<File | null>(null);
  const [meetings, setMeetings] = useState<HrPublicMeetingResultDto[]>([]);
  const [employeeLookup, setEmployeeLookup] = useState<HrPublicEmployeeLookupDto | null>(null);
  const [lookupField, setLookupField] = useState<LookupField | null>(null);
  const [lookupSelectionToken, setLookupSelectionToken] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isMeetingLoading, setIsMeetingLoading] = useState(false);
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitResult, setSubmitResult] = useState<HrPublicSubmissionResultDto | null>(null);
  const [statusResult, setStatusResult] = useState<HrPublicStatusDto | null>(null);

  const institutionName = institution.courtName?.trim() || "Pengadilan";
  const whatsappNumber = normalizeWhatsappNumber(
    institution.botWhatsappNumber || institution.csWhatsappNumber || institution.mobilePhone || ""
  );
  const currentUrl = typeof window === "undefined" ? "" : `${window.location.origin}${withBasePath(servicePath(selectedService))}`;
  const selectedLeaveTypeName = options?.leaveTypes.find((item) => item.id === form.leaveTypeId)?.name ?? "";
  const whatsappUrl = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(buildWhatsappMessage(selectedService, selectedConfig?.title ?? "layanan publik", currentUrl, form, selectedLeaveTypeName))}`
    : "";

  const enabledServiceIds = useMemo(() => {
    if (!options) return new Set<PublicServiceId>();
    const enabled = new Set<PublicServiceId>();
    for (const item of serviceConfigs) {
      if (isFormService(item.id) && options.settings.publicForms[formSettingKey(item.id)]) enabled.add(item.id);
      if (item.id === "agenda-rapat" && options.settings.publicForms.hasilRapat) enabled.add(item.id);
      if (item.id === "cek-status") enabled.add(item.id);
    }
    return enabled;
  }, [options]);

  const selectedEnabled = selectedService ? enabledServiceIds.has(selectedService) : true;
  const lookupIdentifier = form.identifier;
  const lookupName = form.name;
  const lookupContact = form.contact;
  const lookupLeaveTypeId = form.leaveTypeId;
  const lookupStartDate = form.startDate;
  const lookupEndDate = form.endDate;

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setIsLoading(true);
      setError("");

      try {
        const [optionsResponse, institutionResponse] = await Promise.all([
          fetch(apiPath("/api/e-kepegawaian/public/options"), { cache: "no-store", signal: controller.signal }),
          fetch(apiPath("/api/public/institution"), { cache: "no-store", signal: controller.signal }),
        ]);
        const optionsPayload = await readJson<HrPublicOptionsDto>(optionsResponse);
        const institutionPayload = await readJson<InstitutionPublicInfo>(institutionResponse);

        if (!optionsResponse.ok || !optionsPayload.ok || !optionsPayload.data) {
          throw new Error(optionsPayload.error?.message ?? "Pengaturan layanan publik belum dapat dibaca.");
        }

        setOptions(optionsPayload.data);
        setInstitution(institutionResponse.ok && institutionPayload.ok && institutionPayload.data ? institutionPayload.data : {});
        const firstLeaveType = optionsPayload.data.leaveTypes[0]?.id ?? "";
        setForm((current) => ({
          ...current,
          leaveTypeId: current.leaveTypeId || firstLeaveType,
        }));
      } catch (loadError) {
        if ((loadError as { name?: string })?.name !== "AbortError") {
          setError(loadError instanceof Error ? loadError.message : "Layanan publik belum dapat dimuat.");
        }
      } finally {
        setIsLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (selectedService !== "agenda-rapat" || !selectedEnabled) return;
    const controller = new AbortController();

    async function loadMeetings() {
      setIsMeetingLoading(true);
      setError("");

      try {
        const response = await fetch(apiPath("/api/e-kepegawaian/public/hasil-rapat"), {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await readJson<HrPublicMeetingResultDto[]>(response);
        if (!response.ok || !payload.ok || !payload.data) {
          throw new Error(payload.error?.message ?? "Agenda rapat publik belum dapat dibaca.");
        }
        setMeetings(payload.data);
      } catch (meetingError) {
        if ((meetingError as { name?: string })?.name !== "AbortError") {
          setError(meetingError instanceof Error ? meetingError.message : "Agenda rapat publik belum dapat dimuat.");
        }
      } finally {
        setIsMeetingLoading(false);
      }
    }

    void loadMeetings();
    return () => controller.abort();
  }, [selectedEnabled, selectedService]);

  useEffect(() => {
    if (!selectedService || !isFormService(selectedService) || !selectedEnabled) return;
    const selectionToken = lookupSelectionToken;
    const field = lookupField ?? (lookupIdentifier ? "identifier" : lookupContact ? "contact" : lookupName ? "name" : null);
    if (!selectionToken && !field) {
      return;
    }

    const fieldValues: Record<LookupField, string> = {
      identifier: lookupIdentifier,
      name: lookupName,
      contact: lookupContact,
    };
    const value = field ? fieldValues[field].trim() : "";
    const minLength = field === "contact" ? 6 : 4;
    if (!selectionToken && value.length < minLength) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      hideGlobalAutoformLoading();
      setIsLookupLoading(true);
      void fetch(apiPath("/api/e-kepegawaian/public/employee-lookup"), {
        method: "POST",
        headers: { "content-type": "application/json", "x-aleta-silent-loading": "1" },
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify({
          selectionToken,
          field,
          value,
          identifier: lookupIdentifier,
          name: lookupName,
          contact: lookupContact,
          leaveTypeId: selectedService === "cuti" ? lookupLeaveTypeId : "",
          startDate: selectedService === "cuti" ? lookupStartDate : "",
          endDate: selectedService === "cuti" ? lookupEndDate : "",
        }),
      })
        .then(async (response) => {
          const payload = await readJson<HrPublicEmployeeLookupDto>(response);
          if (!response.ok || !payload.ok || !payload.data) {
            throw new Error(payload.error?.message ?? "Data pegawai belum dapat dicocokkan.");
          }
          setEmployeeLookup(payload.data);
          if (payload.data.matched && payload.data.employee) {
            const employee = payload.data.employee;
            setForm((current) => ({
              ...current,
              identifier: selectionToken ? employee.identifier : current.identifier || employee.identifier,
              name: employee.name || current.name,
              contact: selectionToken ? employee.contact : current.contact || employee.contact,
            }));
            setLookupField(null);
          }
        })
        .catch((lookupError) => {
          if ((lookupError as { name?: string })?.name !== "AbortError") {
            setEmployeeLookup({
              matched: false,
              ambiguous: false,
              message: lookupError instanceof Error ? lookupError.message : "Data pegawai belum dapat dicocokkan.",
              suggestions: [],
              employee: null,
              balance: null,
              leavePreview: null,
            });
          }
        })
        .finally(() => {
          hideGlobalAutoformLoading();
          setIsLookupLoading(false);
          if (selectionToken) setLookupSelectionToken("");
        });
    }, selectionToken ? 0 : 450);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    lookupContact,
    lookupEndDate,
    lookupIdentifier,
    lookupLeaveTypeId,
    lookupName,
    lookupSelectionToken,
    lookupStartDate,
    lookupField,
    selectedEnabled,
    selectedService,
  ]);

  function updateField(field: keyof PublicFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    if (field === "identifier" || field === "name" || field === "contact") {
      hideGlobalAutoformLoading();
      setLookupField(field);
      setLookupSelectionToken("");
      const minLength = field === "contact" ? 6 : 4;
      if (value.trim().length < minLength) setEmployeeLookup(null);
    }
    setError("");
    setNotice("");
    setSubmitResult(null);
  }

  function selectEmployeeSuggestion(selectionToken: string) {
    hideGlobalAutoformLoading();
    setLookupSelectionToken(selectionToken);
    setError("");
    setNotice("");
  }

  function updateStatusField(field: keyof StatusFormState, value: string) {
    setStatusForm((current) => ({ ...current, [field]: value }));
    setError("");
    setNotice("");
    setStatusResult(null);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    setError("");
  }

  async function submitPublicForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedService || !isFormService(selectedService) || !selectedEnabled) return;

    setIsSubmitting(true);
    setError("");
    setNotice("");
    setSubmitResult(null);

    try {
      const formData = new FormData();
      formData.set("identifier", form.identifier.trim());
      formData.set("name", form.name.trim());
      formData.set("contact", form.contact.trim());

      if (selectedService === "cuti") {
        formData.set("leaveTypeId", form.leaveTypeId);
        formData.set("startDate", form.startDate);
        formData.set("endDate", form.endDate);
        formData.set("reason", form.reason.trim());
        formData.set("addressDuringLeave", form.addressDuringLeave.trim());
      } else if (selectedService === "upload-pck" || selectedService === "upload-skp" || selectedService === "wfa") {
        formData.set("title", form.title.trim());
        formData.set("periodYear", form.periodYear);
        formData.set("periodMonth", form.periodMonth);
        formData.set("submissionDate", form.submissionDate);
        formData.set("description", form.description.trim());
      } else {
        formData.set("requestDate", form.requestDate);
        formData.set("scheduledTime", form.scheduledTime);
        formData.set("actualTime", form.actualTime);
        formData.set("reason", form.reason.trim());
      }

      if (file) formData.set("file", file);

      const response = await fetch(apiPath(`/api/e-kepegawaian/public/${selectedService}`), {
        method: "POST",
        body: formData,
      });
      const payload = await readJson<HrPublicSubmissionResultDto>(response);

      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Pengajuan belum dapat dikirim.");
      }

      setSubmitResult(payload.data);
      setNotice(payload.data.message);
      setFile(null);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Pengajuan belum dapat dikirim.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitStatusCheck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setError("");
    setNotice("");
    setStatusResult(null);

    try {
      const response = await fetch(apiPath("/api/e-kepegawaian/public/cek-status"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ticketCode: statusForm.ticketCode.trim(),
          verifier: statusForm.verifier.trim(),
        }),
      });
      const payload = await readJson<HrPublicStatusDto>(response);

      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Status belum dapat dicek.");
      }

      setStatusResult(payload.data);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Status belum dapat dicek.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.42))] text-foreground">
      <div className="fixed right-4 top-4 z-20">
        <ThemeToggle />
      </div>

      <section className="border-b border-border/80 bg-card/85 px-4 py-5 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <AletaLogo
            title="ALETA"
            subtitle={`Layanan publik ${institutionName}`}
            logoUrl={institution.logoUrl}
            className="[&_p:last-child]:text-muted-foreground"
          />
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={withBasePath("/login")}>
                <LogIn className="h-4 w-4" />
                Login ALETA
              </Link>
            </Button>
            <Button asChild>
              <Link href={withBasePath("/public/e-kepegawaian/cek-status")}>
                <CheckCircle2 className="h-4 w-4" />
                Cek Status
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 space-y-5">
          <div className="space-y-3">
            {selectedConfig ? (
              <Button asChild variant="ghost" className="px-0">
                <Link href={withBasePath("/public/e-kepegawaian")}>
                  <ArrowLeft className="h-4 w-4" />
                  Semua layanan publik
                </Link>
              </Button>
            ) : null}
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="space-y-2">
                <Badge variant="outline">E-Kepegawaian Tanpa Login</Badge>
                <h1 className="font-serif text-3xl leading-tight text-foreground md:text-4xl">
                  {selectedConfig?.title ?? "Layanan pegawai tanpa login"}
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                  {selectedConfig?.description ??
                    "Pegawai dapat mengirim permohonan dan setoran administratif melalui URL langsung, menu login, atau tautan WhatsApp resmi."}
                </p>
              </div>
              {selectedConfig ? (
                <Badge variant={selectedEnabled ? "success" : "warning"}>
                  {selectedEnabled ? "Aktif" : "Dinonaktifkan Admin"}
                </Badge>
              ) : null}
            </div>
          </div>

          {options?.settings.publicInstructions ? (
            <div className="rounded-xl border border-sky-200/80 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-800 dark:border-sky-300/30 dark:bg-sky-500/10 dark:text-sky-100">
              {options.settings.publicInstructions}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-300/30 dark:bg-rose-500/10 dark:text-rose-100">
              {error}
            </div>
          ) : null}

          {notice ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-300/30 dark:bg-emerald-500/10 dark:text-emerald-100">
              {notice}
            </div>
          ) : null}

          {isLoading ? (
            <Card>
              <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Memuat layanan publik E-Kepegawaian...
              </CardContent>
            </Card>
          ) : selectedConfig ? (
            <SelectedServiceView
              config={selectedConfig}
              enabled={selectedEnabled}
              options={options}
              form={form}
              statusForm={statusForm}
              file={file}
              employeeLookup={employeeLookup}
              submitResult={submitResult}
              statusResult={statusResult}
              meetings={meetings}
              isMeetingLoading={isMeetingLoading}
              isLookupLoading={isLookupLoading}
              isSubmitting={isSubmitting}
              onChange={updateField}
              onSelectEmployeeSuggestion={selectEmployeeSuggestion}
              onStatusChange={updateStatusField}
              onFileChange={handleFileChange}
              onSubmitForm={submitPublicForm}
              onSubmitStatus={submitStatusCheck}
            />
          ) : (
            <ServiceHub enabledServiceIds={enabledServiceIds} />
          )}
        </section>

        <aside className="space-y-4">
          <Card className="border-border/80">
            <CardHeader>
              <CardTitle>3 Cara Akses</CardTitle>
              <CardDescription>Semua masuk ke layanan publik yang sama dan tetap dicatat di E-Kepegawaian.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <MethodItem title="URL langsung" description="Buka tautan form publik sesuai kebutuhan." />
              <MethodItem title="Menu di login" description="Pilih layanan tanpa login dari halaman Login ALETA." />
              <MethodItem title="WhatsApp" description="Chat Bot/CS resmi untuk meminta tautan dan panduan aman." />
            </CardContent>
          </Card>

          <Card className="border-border/80">
            <CardHeader>
              <CardTitle>{isCutiWhatsappMode ? "WhatsApp Permohonan Cuti" : "WhatsApp Resmi"}</CardTitle>
              <CardDescription>
                {isCutiWhatsappMode
                  ? "Kirim format chat khusus cuti ke WhatsApp resmi. Periksa kembali isi pesan sebelum dikirim."
                  : "Gunakan WhatsApp hanya untuk meminta tautan atau panduan. Jangan kirim password atau data sensitif lengkap."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {whatsappUrl ? (
                <Button asChild className="w-full">
                  <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-4 w-4" />
                    {isCutiWhatsappMode ? "Kirim Chat Cuti" : "Buka WhatsApp"}
                  </a>
                </Button>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-300/30 dark:bg-amber-500/10 dark:text-amber-100">
                  Nomor WhatsApp publik belum diatur di Identitas Instansi.
                </div>
              )}
              <p className="text-xs leading-5 text-muted-foreground">
                {isCutiWhatsappMode
                  ? "Format chat memakai MODE: EKEPEGAWAIAN_PERMOHONAN_CUTI dan mengikuti data yang sudah terisi di form."
                  : "Format aman: sebutkan layanan yang dibutuhkan, lalu lanjutkan pengisian data melalui halaman publik ALETA."}
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  );
}

function ServiceHub({ enabledServiceIds }: { enabledServiceIds: Set<PublicServiceId> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {serviceConfigs.map((service) => {
        const Icon = service.icon;
        const enabled = enabledServiceIds.has(service.id);

        return (
          <Link
            key={service.id}
            href={withBasePath(servicePath(service.id))}
            className="group rounded-xl border border-border/80 bg-card p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <Badge variant={enabled ? "success" : "warning"}>{enabled ? "Aktif" : "Nonaktif"}</Badge>
            </div>
            <h2 className="mt-4 text-base font-semibold text-foreground group-hover:text-primary">{service.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{service.description}</p>
          </Link>
        );
      })}
    </div>
  );
}

function SelectedServiceView({
  config,
  enabled,
  options,
  form,
  statusForm,
  file,
  employeeLookup,
  submitResult,
  statusResult,
  meetings,
  isMeetingLoading,
  isLookupLoading,
  isSubmitting,
  onChange,
  onSelectEmployeeSuggestion,
  onStatusChange,
  onFileChange,
  onSubmitForm,
  onSubmitStatus,
}: {
  config: NonNullable<ReturnType<typeof getServiceConfig>>;
  enabled: boolean;
  options: HrPublicOptionsDto | null;
  form: PublicFormState;
  statusForm: StatusFormState;
  file: File | null;
  employeeLookup: HrPublicEmployeeLookupDto | null;
  submitResult: HrPublicSubmissionResultDto | null;
  statusResult: HrPublicStatusDto | null;
  meetings: HrPublicMeetingResultDto[];
  isMeetingLoading: boolean;
  isLookupLoading: boolean;
  isSubmitting: boolean;
  onChange: (field: keyof PublicFormState, value: string) => void;
  onSelectEmployeeSuggestion: (selectionToken: string) => void;
  onStatusChange: (field: keyof StatusFormState, value: string) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSubmitForm: (event: FormEvent<HTMLFormElement>) => void;
  onSubmitStatus: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (!enabled) {
    return (
      <Card>
        <CardContent className="p-6 text-sm leading-6 text-muted-foreground">
          Layanan ini sedang dinonaktifkan oleh admin E-Kepegawaian. Gunakan kanal internal atau hubungi admin kepegawaian.
        </CardContent>
      </Card>
    );
  }

  if (config.id === "cek-status") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cek Status Tiket</CardTitle>
          <CardDescription>Masukkan kode tiket dan verifier yang sama dengan data saat submit.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmitStatus}>
            <PublicField label="Kode tiket">
              <Input value={statusForm.ticketCode} onChange={(event) => onStatusChange("ticketCode", event.target.value)} placeholder="Contoh: EKP-20260528-ABC123" />
            </PublicField>
            <PublicField label="NIP/NIK atau nomor HP">
              <Input value={statusForm.verifier} onChange={(event) => onStatusChange("verifier", event.target.value)} placeholder="Data pencocokan status" />
            </PublicField>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Cek Status
            </Button>
          </form>

          {statusResult ? (
            <div className="mt-5 rounded-xl border border-border bg-muted/35 p-4">
              <p className="text-sm font-semibold text-foreground">{statusResult.formLabel}</p>
              <p className="mt-1 text-sm text-muted-foreground">Tiket: {statusResult.ticketCode}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="success">{statusResult.statusLabel}</Badge>
                <Badge variant="outline">{formatDate(statusResult.submittedAt.slice(0, 10))}</Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{statusResult.nextInstruction}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  if (config.id === "agenda-rapat") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Agenda dan Hasil Rapat Publik</CardTitle>
          <CardDescription>Data yang tampil hanya rapat berstatus publik dan dipublikasikan oleh admin.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isMeetingLoading ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Memuat agenda rapat...
            </div>
          ) : meetings.length ? (
            meetings.map((meeting) => (
              <article key={meeting.id} className="rounded-xl border border-border bg-muted/25 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="font-semibold text-foreground">{meeting.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatDate(meeting.meetingDate)} {meeting.location ? `- ${meeting.location}` : ""}
                    </p>
                  </div>
                  <Badge variant="outline">{meeting.category || "umum"}</Badge>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{meeting.summary}</p>
                {meeting.participants ? (
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">Peserta: {meeting.participants}</p>
                ) : null}
              </article>
            ))
          ) : (
            <div className="rounded-xl border border-border bg-muted/25 p-4 text-sm text-muted-foreground">
              Belum ada agenda atau hasil rapat publik.
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{config.methodLabel}</CardTitle>
        <CardDescription>
          Data akan dicocokkan dengan profil pegawai aktif. Simpan kode tiket setelah pengajuan berhasil.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={onSubmitForm}>
          <div className="grid gap-4 md:grid-cols-2">
            <PublicField label="NIP/NIK/Nomor Pegawai">
              <Input value={form.identifier} onChange={(event) => onChange("identifier", event.target.value)} placeholder="Identitas pegawai terdaftar" required />
            </PublicField>
            <PublicField label="Nomor HP">
              <Input value={form.contact} onChange={(event) => onChange("contact", event.target.value)} placeholder="Nomor yang bisa dihubungi" required />
            </PublicField>
            <PublicField label="Nama">
              <Input value={form.name} onChange={(event) => onChange("name", event.target.value)} placeholder="Nama lengkap" />
            </PublicField>
          </div>
          <EmployeeLookupPanel lookup={employeeLookup} isLoading={isLookupLoading} onSelectSuggestion={onSelectEmployeeSuggestion} />

          {config.id === "cuti" ? (
            <LeaveFields options={options} form={form} lookup={employeeLookup} onChange={onChange} />
          ) : config.id === "upload-pck" || config.id === "upload-skp" || config.id === "wfa" ? (
            <SubmissionFields serviceId={config.id} form={form} file={file} onChange={onChange} onFileChange={onFileChange} />
          ) : (
            <AttendanceFields serviceId={config.id} form={form} file={file} onChange={onChange} onFileChange={onFileChange} />
          )}

          {config.id === "cuti" ? (
            <PublicField label="Lampiran pendukung">
              <Input type="file" onChange={onFileChange} />
              <p className="text-xs leading-5 text-muted-foreground">
                Opsional kecuali jenis cuti mensyaratkan lampiran. Format mengikuti pengaturan admin.
              </p>
            </PublicField>
          ) : null}

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Kirim Pengajuan
          </Button>
        </form>

        {submitResult ? (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-300/30 dark:bg-emerald-500/10 dark:text-emerald-100">
            <p className="font-semibold">Pengajuan diterima</p>
            <p className="mt-1 text-sm">Kode tiket: <strong>{submitResult.ticketCode}</strong></p>
            <Button asChild variant="outline" className="mt-3 bg-white/70 dark:bg-transparent">
              <Link href={withBasePath("/public/e-kepegawaian/cek-status")}>
                <CheckCircle2 className="h-4 w-4" />
                Cek Status
              </Link>
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function EmployeeLookupPanel({
  lookup,
  isLoading,
  onSelectSuggestion,
}: {
  lookup: HrPublicEmployeeLookupDto | null;
  isLoading: boolean;
  onSelectSuggestion: (selectionToken: string) => void;
}) {
  const suggestions = lookup?.suggestions ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/25 px-4 py-3 text-sm text-muted-foreground">
        <LoaderCircle className="h-4 w-4 animate-spin" />
        Mencocokkan data pegawai di form...
      </div>
    );
  }

  if (!lookup) {
    return (
      <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 text-xs leading-5 text-muted-foreground">
        Isi salah satu data pegawai. Jika cocok, nama, NIP/NIK/nomor pegawai, nomor HP, dan saldo cuti akan terisi otomatis.
      </div>
    );
  }

  if (!lookup.matched) {
    return (
      <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800 dark:border-amber-300/30 dark:bg-amber-500/10 dark:text-amber-100">
        <p>{lookup.message}</p>
        {suggestions.length ? (
          <div className="overflow-hidden rounded-xl border border-amber-200 bg-white/85 shadow-sm dark:border-amber-300/20 dark:bg-slate-950/50">
            <p className="border-b border-amber-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-amber-700 dark:border-amber-300/10 dark:text-amber-100">
              Pilih pegawai
            </p>
            <div role="listbox" className="max-h-72 overflow-auto">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.selectionToken}
                  type="button"
                  role="option"
                  aria-selected="false"
                  className="block w-full border-b border-amber-100 px-3 py-3 text-left transition last:border-b-0 hover:bg-amber-100/75 focus:outline-none focus:ring-2 focus:ring-amber-400 dark:border-amber-300/10 dark:hover:bg-amber-300/10"
                  onClick={() => onSelectSuggestion(suggestion.selectionToken)}
                >
                  <span className="block text-sm font-semibold text-foreground">{suggestion.name}</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {suggestion.positionName || "-"} - {suggestion.unitKerja || "-"}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    ID {suggestion.identifierMasked || "-"} | HP {suggestion.contactMasked || "-"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-300/30 dark:bg-emerald-500/10 dark:text-emerald-100">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold">{lookup.employee?.name}</p>
          <p className="mt-1 text-xs leading-5 opacity-85">
            {lookup.employee?.positionName || "-"} - {lookup.employee?.unitKerja || "-"} - {lookup.employee?.employmentStatusLabel || "-"}
          </p>
          <p className="mt-1 text-xs leading-5 opacity-85">
            ID: {lookup.employee?.identifierMasked || "-"} | HP: {lookup.employee?.contactMasked || "-"}
          </p>
        </div>
        <Badge variant="success">Data cocok</Badge>
      </div>
      {lookup.balance ? (
        <p className="mt-3 text-xs leading-5 opacity-85">
          Saldo tersedia tahun {lookup.balance.year}: {formatDays(lookup.balance.availableDays)} hari.
        </p>
      ) : null}
    </div>
  );
}

function LeaveBalancePreview({ lookup }: { lookup: HrPublicEmployeeLookupDto | null }) {
  if (!lookup?.matched || !lookup.balance) return null;

  const preview = lookup.leavePreview;
  const buckets = preview?.buckets ?? lookup.balance.buckets;
  const calendarDays = preview?.calendarDays ?? [];
  const impactRows = preview?.dailyImpacts ?? [];
  const peakImpact = impactRows.reduce<HrLeaveDailyImpactDto | null>((peak, item) => (
    !peak || item.simulatedLeavePercentage > peak.simulatedLeavePercentage ? item : peak
  ), null);

  return (
    <section className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Saldo dan kalender cuti</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Perhitungan mengikuti pengaturan E-Kepegawaian: {preview?.calculationType === "calendar_days" ? "hari kalender" : "hari kerja"}.
          </p>
        </div>
        {preview ? (
          <Badge variant={preview.enoughBalance ? "success" : "warning"}>
            {formatDays(preview.totalDays)} hari cuti
          </Badge>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {buckets.map((bucket) => (
          <div key={bucket.source} className="rounded-xl border border-border bg-card/80 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{bucket.source}</p>
            <p className="mt-2 text-lg font-semibold text-foreground">{formatDays(bucket.availableDays)} hari</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Awal {formatDays(bucket.initialDays)} hari
              {preview ? ` | Setelah cuti ${formatDays(bucket.afterRequestDays)} hari` : ""}
            </p>
          </div>
        ))}
      </div>

      {lookup.balance.usedDays || lookup.balance.pendingDays ? (
        <p className="text-xs leading-5 text-muted-foreground">
          Terpakai {formatDays(lookup.balance.usedDays)} hari, sedang proses {formatDays(lookup.balance.pendingDays)} hari.
        </p>
      ) : null}

      {preview?.warnings.length ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800 dark:border-amber-300/30 dark:bg-amber-500/10 dark:text-amber-100">
          {preview.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}

      {peakImpact ? (
        <div data-testid="public-leave-impact-preview" className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Simulasi pegawai cuti</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Puncak {formatDate(peakImpact.date)}: {peakImpact.totalOnLeaveWithSimulation} dari {peakImpact.totalEmployees} pegawai ({formatPercent(peakImpact.simulatedLeavePercentage)}).
              </p>
            </div>
            <Badge variant={peakImpact.simulatedLeavePercentage >= 30 ? "warning" : "success"}>
              {formatPercent(peakImpact.simulatedLeavePercentage)}
            </Badge>
          </div>
          <div className="grid gap-2">
            {impactRows.slice(0, 5).map((row) => (
              <div key={row.date} className="flex flex-col gap-1 rounded-lg border border-border bg-card/70 px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                <span className="font-semibold text-foreground">{formatDate(row.date)}</span>
                <span className="text-muted-foreground">
                  Aktual {row.approvedLeaveEmployees}, proses {row.pendingLeaveEmployees}, simulasi {row.totalOnLeaveWithSimulation} ({formatPercent(row.simulatedLeavePercentage)})
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {calendarDays.length ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Deteksi kalender</p>
          <div className="max-h-64 space-y-2 overflow-auto pr-1">
            {calendarDays.map((day) => (
              <div
                key={day.date}
                className="flex flex-col gap-2 rounded-xl border border-border bg-card/75 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">{formatDate(day.date)}</p>
                  <p className="text-xs leading-5 text-muted-foreground">{day.dayName} - {day.label}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={day.counted ? "success" : "warning"}>{day.counted ? "Dihitung" : "Tidak dihitung"}</Badge>
                  {day.isHoliday || day.isWeekend ? <Badge variant="outline">{day.type === "weekend" ? "Akhir pekan" : day.type}</Badge> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function LeaveFields({
  options,
  form,
  lookup,
  onChange,
}: {
  options: HrPublicOptionsDto | null;
  form: PublicFormState;
  lookup: HrPublicEmployeeLookupDto | null;
  onChange: (field: keyof PublicFormState, value: string) => void;
}) {
  const selectedLeaveType = options?.leaveTypes.find((item) => item.id === form.leaveTypeId);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <PublicField label="Jenis cuti">
          <NativeSelect value={form.leaveTypeId} onChange={(event) => onChange("leaveTypeId", event.target.value)} required>
            {(options?.leaveTypes ?? []).map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </NativeSelect>
        </PublicField>
        <PublicField label="Tanggal mulai">
          <Input type="date" value={form.startDate} onChange={(event) => onChange("startDate", event.target.value)} required />
        </PublicField>
        <PublicField label="Tanggal selesai">
          <Input type="date" value={form.endDate} onChange={(event) => onChange("endDate", event.target.value)} required />
        </PublicField>
      </div>
      <LeaveBalancePreview lookup={lookup} />
      {selectedLeaveType?.requiresAttachment ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-300/30 dark:bg-amber-500/10 dark:text-amber-100">
          Jenis cuti ini memerlukan lampiran pendukung.
        </div>
      ) : null}
      <PublicField label="Alasan cuti">
        <Textarea value={form.reason} onChange={(event) => onChange("reason", event.target.value)} rows={3} required />
      </PublicField>
      <PublicField label="Alamat selama cuti">
        <Textarea value={form.addressDuringLeave} onChange={(event) => onChange("addressDuringLeave", event.target.value)} rows={3} required />
      </PublicField>
    </div>
  );
}

function SubmissionFields({
  serviceId,
  form,
  file,
  onChange,
  onFileChange,
}: {
  serviceId: Extract<PublicServiceId, "upload-pck" | "upload-skp" | "wfa">;
  form: PublicFormState;
  file: File | null;
  onChange: (field: keyof PublicFormState, value: string) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const requiresFile = serviceId === "upload-pck" || serviceId === "upload-skp";

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <PublicField label="Judul">
          <Input value={form.title} onChange={(event) => onChange("title", event.target.value)} placeholder={serviceId === "wfa" ? "Laporan WFA" : "Judul setoran"} />
        </PublicField>
        <PublicField label="Tahun">
          <Input type="number" value={form.periodYear} onChange={(event) => onChange("periodYear", event.target.value)} required />
        </PublicField>
        <PublicField label="Bulan">
          <NativeSelect value={form.periodMonth} onChange={(event) => onChange("periodMonth", event.target.value)}>
            <option value="">Tidak ditentukan</option>
            {Array.from({ length: 12 }, (_, index) => String(index + 1)).map((value) => (
              <option key={value} value={value}>{safeMonthLabel(value)}</option>
            ))}
          </NativeSelect>
        </PublicField>
      </div>
      <PublicField label="Tanggal setoran">
        <Input type="date" value={form.submissionDate} onChange={(event) => onChange("submissionDate", event.target.value)} />
      </PublicField>
      <PublicField label="Keterangan">
        <Textarea value={form.description} onChange={(event) => onChange("description", event.target.value)} rows={3} placeholder="Ringkasan dokumen atau kegiatan" />
      </PublicField>
      <PublicField label={requiresFile ? "Lampiran wajib" : "Lampiran"}>
        <Input type="file" onChange={onFileChange} required={requiresFile} />
        <p className="text-xs leading-5 text-muted-foreground">
          {file ? `File dipilih: ${file.name}` : requiresFile ? "PCK/SKP wajib memakai lampiran." : "Opsional untuk laporan WFA."}
        </p>
      </PublicField>
    </div>
  );
}

function AttendanceFields({
  serviceId,
  form,
  file,
  onChange,
  onFileChange,
}: {
  serviceId: Extract<PublicServiceId, "lambat-datang" | "cepat-pulang">;
  form: PublicFormState;
  file: File | null;
  onChange: (field: keyof PublicFormState, value: string) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <PublicField label="Tanggal">
          <Input type="date" value={form.requestDate} onChange={(event) => onChange("requestDate", event.target.value)} required />
        </PublicField>
        <PublicField label={serviceId === "lambat-datang" ? "Jam seharusnya datang" : "Jam seharusnya pulang"}>
          <Input type="time" value={form.scheduledTime} onChange={(event) => onChange("scheduledTime", event.target.value)} required />
        </PublicField>
        <PublicField label={serviceId === "lambat-datang" ? "Jam datang" : "Jam pulang"}>
          <Input type="time" value={form.actualTime} onChange={(event) => onChange("actualTime", event.target.value)} required />
        </PublicField>
      </div>
      <PublicField label="Alasan">
        <Textarea value={form.reason} onChange={(event) => onChange("reason", event.target.value)} rows={3} required />
      </PublicField>
      <PublicField label="Lampiran pendukung">
        <Input type="file" onChange={onFileChange} />
        <p className="text-xs leading-5 text-muted-foreground">{file ? `File dipilih: ${file.name}` : "Opsional jika ada surat tugas atau bukti pendukung."}</p>
      </PublicField>
    </div>
  );
}

function PublicField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2 text-sm font-medium text-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}

function MethodItem({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/25 p-3">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
    </div>
  );
}
