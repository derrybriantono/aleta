"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Eye, FileText, Pencil, RefreshCw, RotateCcw, Search, Send, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { apiPath } from "@/lib/base-path";
import { getJlfFieldModeLabel, getLegacyAbtTypeLabel } from "@/lib/judicia-legal-form-abt";
import {
  findJlfCaseTypeOption,
  inferJlfCaseNumberCode,
  JLF_CASE_NUMBER_CODE_OPTIONS,
  JLF_CASE_TYPE_GROUPS,
  jlfCaseTypeMatches,
} from "@/lib/judicia-legal-form-case-types";
import { buildJlfHearingContext, sortJlfHearings } from "@/lib/judicia-legal-form-hearings";
import { JUDICIA_LEGAL_FORM_ROUTE } from "@/lib/judicia-legal-form-types";

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { message?: string };
};

type TemplateItem = {
  id: string;
  categoryId?: string;
  categoryName?: string;
  name: string;
  documentType?: string;
  status: string;
  fileType: string;
  requiresValidation: boolean;
  supportsAi?: boolean;
};

type CategoryItem = {
  id: string;
  name: string;
  slug: string;
};

type CaseSummary = {
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkara?: string;
  paraPihak?: string;
  tahapan?: string;
  tanggalDaftar?: string;
  statusPerkara?: string;
};

type CaseBundle = {
  detail: CaseSummary | null;
  schedule: unknown[];
  lastHearing?: unknown | null;
  nextHearing?: unknown | null;
  decision?: Record<string, unknown> | null;
  diagnostics?: {
    warnings?: string[];
  };
};

type DocumentPreview = {
  variables: Array<{
    key: string;
    placeholder: string;
    value: unknown;
    source: string;
    error?: string;
    warnings?: string[];
    legacyCode?: string | null;
    label?: string;
    dataType?: string;
    sourceType?: string;
    legacyAbtType?: string;
    fieldMode?: string;
    manualOverride?: boolean;
    aiEnabled?: boolean;
    manualOverrideAllowed?: boolean;
  }>;
  missingRequiredVariables: unknown[];
  unknownPlaceholders: UnknownPlaceholder[];
  warnings: string[];
  parserWarnings: string[];
  canRender: boolean;
};

type UnknownPlaceholder = {
  placeholder?: string;
  normalizedKey?: string;
  kind?: string;
  count?: number;
  source?: string;
  type?: string;
  reason?: string;
  recommendation?: string;
};

type GeneratedDocument = {
  id: string;
  status: string;
  templateName?: string;
  nomorPerkara?: string;
  outputFileType?: string;
  checksum?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
};

async function readApi<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error?.message ?? "Permintaan JLF belum berhasil.");
  }
  return payload?.data as T;
}

function stringifyValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function objectValue(value: unknown, keys: string[]) {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const found = record[key];
    if (found !== undefined && found !== null && String(found).trim()) return String(found);
  }
  return "";
}

function hearingLabel(value: unknown, index: number) {
  const sidangKe = objectValue(value, ["sidangKe", "sidang_ke", "urutan"]);
  const tanggal = objectValue(value, ["tanggalSidang", "tanggal_sidang", "tanggal"]);
  const jam = objectValue(value, ["jamSidang", "jam_sidang", "jam"]);
  const agenda = objectValue(value, ["agendaSidang", "agenda_sidang", "agenda"]);
  return [`Sidang ${sidangKe || index + 1}`, tanggal, jam, agenda].filter(Boolean).join(" - ");
}

function hearingSummary(value: unknown, index: number) {
  return {
    order: objectValue(value, ["sidangKe", "sidang_ke", "urutan"]) || String(index + 1),
    date: objectValue(value, ["tanggalSidang", "tanggal_sidang", "tanggal"]),
    time: objectValue(value, ["jamSidang", "jam_sidang", "jam"]),
    agenda: objectValue(value, ["agendaSidang", "agenda_sidang", "agenda"]),
    room: objectValue(value, ["ruangan", "ruang_sidang", "room"]),
    status: objectValue(value, ["status", "keterangan"]),
  };
}

function maskSensitiveText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\b\d{16}\b/g, (match) => `${match.slice(0, 4)}********${match.slice(-4)}`)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email disamarkan]")
    .replace(/\b(?:\+?62|0)8\d{7,12}\b/g, "[telepon disamarkan]");
}

function cleanDisplayText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSearchText(value: unknown) {
  return String(value ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

type DecisionCategory = "kabul" | "tolak" | "niet" | "gugur" | "dicabut" | "lainnya";

const DECISION_CATEGORIES: Array<{ value: DecisionCategory; label: string }> = [
  { value: "kabul", label: "Kabul" },
  { value: "tolak", label: "Tolak" },
  { value: "niet", label: "Tidak dapat diterima" },
  { value: "gugur", label: "Gugur" },
  { value: "dicabut", label: "Dicabut" },
  { value: "lainnya", label: "Lainnya" },
];

function classifyDecisionFromText(value: unknown): DecisionCategory | null {
  const text = normalizeSearchText(value);
  if (!text) return null;
  if (/(tidak dapat diterima|niet ontvankelijk|\bn\.?\s*o\.?\b)/i.test(text)) return "niet";
  if (/(ditolak|menolak|tolak)/i.test(text)) return "tolak";
  if (/(dicabut|cabut)/i.test(text)) return "dicabut";
  if (/gugur/i.test(text)) return "gugur";
  if (/(dikabulkan|mengabulkan|kabul)/i.test(text)) return "kabul";
  return null;
}

function classifyTemplateDecision(template: TemplateItem): DecisionCategory {
  return classifyDecisionFromText([template.name, template.categoryName, template.documentType].filter(Boolean).join(" ")) ?? "lainnya";
}

function stringifyForDecision(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function classifyCaseDecision(caseItem: CaseSummary | null, bundle: CaseBundle | null): DecisionCategory | null {
  return classifyDecisionFromText(
    [
      caseItem?.jenisPerkara,
      caseItem?.statusPerkara,
      caseItem?.tahapan,
      stringifyForDecision(bundle?.detail),
      stringifyForDecision(bundle?.decision),
    ].filter(Boolean).join(" ")
  );
}

function caseMatchesType(item: CaseSummary, caseType: string) {
  return jlfCaseTypeMatches(item.jenisPerkara, caseType);
}

type JlfReviewStatus = "sipp" | "manual" | "empty" | "needs_review" | "computed";

type VariableFilter = "all" | JlfReviewStatus | "required_empty" | "unknown" | "filled" | "manual_editable" | "automatic";

const VARIABLE_FILTER_OPTIONS: Array<{ value: VariableFilter; label: string }> = [
  { value: "all", label: "Semua variabel" },
  { value: "required_empty", label: "Wajib kosong" },
  { value: "filled", label: "Sudah terisi" },
  { value: "empty", label: "Kosong" },
  { value: "unknown", label: "Tidak dikenali" },
  { value: "manual_editable", label: "Bisa diedit" },
  { value: "automatic", label: "Otomatis" },
  { value: "needs_review", label: "Perlu review" },
  { value: "sipp", label: "SIPP" },
  { value: "computed", label: "Otomatis/Statis" },
  { value: "manual", label: "Diubah Manual" },
];

const LAST_TEMPLATE_STORAGE_KEY = "jlf.quick.lastTemplateId";
const CASE_SEARCH_MIN_LENGTH = 1;
const SILENT_JLF_HEADERS = { "x-aleta-silent-loading": "1" };
const JSON_SILENT_JLF_HEADERS = { "Content-Type": "application/json", "x-aleta-silent-loading": "1" };

function isEmptyResolvedValue(value: unknown) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function humanizeResolverWarning(value: string) {
  const normalized = value.toLowerCase();
  if (!value.trim()) return "";
  if (normalized.includes("resolver returned null") || normalized.includes("resolved null")) {
    return "Data belum ditemukan dari sumber yang dipilih.";
  }
  if (normalized.includes("source_key") || normalized.includes("undefined")) {
    return "Sumber data variabel ini belum lengkap dan perlu dicek admin.";
  }
  if (normalized.includes("query failed") || normalized.includes("database") || normalized.includes("sql")) {
    return "Data belum dapat dibaca dari sumber SIPP. Coba lagi atau minta admin memeriksa mapping.";
  }
  if (normalized.includes("needs_review") || normalized.includes("review")) {
    return "Variabel ini perlu dicek admin sebelum dipakai sebagai final.";
  }
  if (normalized.includes("unknown")) {
    return "Placeholder tidak dikenali atau belum dimapping.";
  }
  return value;
}

function getVariableStatus(variable: DocumentPreview["variables"][number]): JlfReviewStatus {
  const source = `${variable.sourceType ?? ""} ${variable.source ?? ""}`.toLowerCase();
  const warnings = `${variable.error ?? ""} ${(variable.warnings ?? []).join(" ")}`.toLowerCase();

  if (isEmptyResolvedValue(variable.value)) return "empty";
  if (variable.error || warnings.includes("needs_review") || warnings.includes("review") || warnings.includes("unknown")) {
    return "needs_review";
  }
  if (source.includes("manual") || source.includes("jlf_manual")) return "manual";
  if (source.includes("sipp")) return "sipp";
  return "computed";
}

function statusBadgeMeta(status: JlfReviewStatus) {
  switch (status) {
    case "sipp":
      return { label: "SIPP", variant: "success" as const };
    case "manual":
      return { label: "Manual", variant: "default" as const };
    case "empty":
      return { label: "Kosong", variant: "danger" as const };
    case "needs_review":
      return { label: "Perlu review", variant: "warning" as const };
    case "computed":
      return { label: "Otomatis", variant: "outline" as const };
  }
}

function sourceLabel(variable: DocumentPreview["variables"][number]) {
  const source = variable.sourceType || variable.source || "";
  if (source.includes("sipp_perkara")) return "SIPP Perkara";
  if (source.includes("sipp_pihak")) return "SIPP Pihak";
  if (source.includes("sipp_jadwal_sidang")) return "SIPP Sidang";
  if (source.includes("sipp_hakim")) return "SIPP Hakim";
  if (source.includes("sipp_panitera")) return "SIPP Panitera";
  if (source.includes("sipp_jurusita")) return "SIPP Jurusita";
  if (source.includes("sipp_putusan")) return "SIPP Putusan";
  if (source.includes("sipp_keuangan")) return "SIPP Biaya";
  if (source.includes("jlf_manual")) return "Data Manual";
  if (source.includes("jlf_bas_qa")) return "Tanya Jawab/BAS";
  if (source.includes("function")) return "Fungsi";
  if (source.includes("computed")) return "Otomatis";
  if (source.includes("static")) return "Statis";
  if (source.includes("qrcode")) return "QR";
  return source || "-";
}

function warningLabel(variable: DocumentPreview["variables"][number]) {
  if (variable.error) return humanizeResolverWarning(variable.error);
  if (isEmptyResolvedValue(variable.value)) {
    return variable.warnings?.length
      ? variable.warnings.map(humanizeResolverWarning).join("; ")
      : "Data kosong, isi manual bila diperlukan.";
  }
  if (variable.warnings?.length) return variable.warnings.map(humanizeResolverWarning).join("; ");
  return "-";
}

function isUnknownVariable(variable: DocumentPreview["variables"][number]) {
  const text = [variable.error, ...(variable.warnings ?? []), variable.sourceType, variable.source, variable.legacyAbtType, variable.fieldMode]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return text.includes("unknown") || text.includes("belum dimapping") || text.includes("belum memiliki resolver");
}

function variableFilterMatches(variable: DocumentPreview["variables"][number], filter: VariableFilter) {
  const status = getVariableStatus(variable);
  if (filter === "all") return true;
  if (filter === "required_empty") return status === "empty" && Boolean(variable.error);
  if (filter === "filled") return !isEmptyResolvedValue(variable.value);
  if (filter === "unknown") return isUnknownVariable(variable);
  if (filter === "manual_editable") return variable.manualOverrideAllowed !== false;
  if (filter === "automatic") return status === "sipp" || status === "computed";
  return status === filter;
}

function variableTypeKey(variable: DocumentPreview["variables"][number]) {
  return variable.legacyAbtType || variable.fieldMode || variable.sourceType || variable.dataType || "unknown";
}

function variableTypeLabel(variable: DocumentPreview["variables"][number]) {
  if (variable.legacyAbtType) return getLegacyAbtTypeLabel(variable.legacyAbtType);
  if (variable.fieldMode) return getJlfFieldModeLabel(variable.fieldMode);
  return variable.sourceType || variable.dataType || "Tidak dikenali";
}

function getManualValueType(variable?: DocumentPreview["variables"][number] | null) {
  const dataType = `${variable?.dataType ?? ""} ${variable?.fieldMode ?? ""} ${variable?.legacyAbtType ?? ""}`.toLowerCase();
  if (dataType.includes("date") || dataType.includes("tanggal")) return "date";
  if (dataType.includes("number") || dataType.includes("numeric") || dataType.includes("angka")) return "number";
  return "text";
}

function getManualInitialValue(variable: DocumentPreview["variables"][number]) {
  const value = stringifyValue(variable.value);
  if (getManualValueType(variable) !== "date") return value;
  return value.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? "";
}

function prefersInlineTextarea(variable: DocumentPreview["variables"][number]) {
  const value = stringifyValue(variable.value);
  const typeText = `${variable.dataType ?? ""} ${variable.fieldMode ?? ""} ${variable.legacyAbtType ?? ""}`.toLowerCase();
  return value.includes("\n") || value.length > 120 || typeText.includes("long") || typeText.includes("text_area");
}

function readUnknownText(value: unknown, key: keyof UnknownPlaceholder) {
  if (!value || typeof value !== "object") return "";
  const found = (value as Record<string, unknown>)[key];
  return found === undefined || found === null ? "" : String(found);
}

function unknownPlaceholderDetail(value: unknown, index: number) {
  if (typeof value === "string") {
    return {
      code: value,
      source: "Template blangko",
      type: "-",
      reason: "Placeholder ada di blangko tetapi belum ada mapping aktif.",
      recommendation: "Tambahkan mapping variabel atau perbaiki placeholder template.",
    };
  }

  const placeholder = readUnknownText(value, "placeholder");
  const normalizedKey = readUnknownText(value, "normalizedKey");
  const kind = readUnknownText(value, "kind");
  const count = readUnknownText(value, "count");
  return {
    code: placeholder || normalizedKey || `unknown-${index + 1}`,
    source: readUnknownText(value, "source") || "Template blangko",
    type: readUnknownText(value, "type") || kind || "-",
    reason: readUnknownText(value, "reason") || "Placeholder belum cocok dengan katalog variabel JLF/ABT.",
    recommendation: readUnknownText(value, "recommendation") || "Cek mapping, tipe variabel, pratinjau query, atau buat handler baru.",
    meta: [normalizedKey ? `key: ${normalizedKey}` : "", count ? `muncul: ${count}` : ""].filter(Boolean).join(" | "),
  };
}

function templateStatusVariant(status: string) {
  if (status === "active") return "success" as const;
  if (status === "draft") return "warning" as const;
  if (status === "archived") return "muted" as const;
  return "outline" as const;
}

export function JlfQuickBlankoWorkbench({
  canSearch,
  canPreview,
  canGenerate,
  canDownload,
  canSubmitValidation,
  canManual,
  canViewSensitive,
  canManageVariables = false,
}: {
  canSearch: boolean;
  canPreview: boolean;
  canGenerate: boolean;
  canDownload: boolean;
  canSubmitValidation: boolean;
  canManual: boolean;
  canViewSensitive: boolean;
  canManageVariables?: boolean;
}) {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [decisionCategory, setDecisionCategory] = useState<DecisionCategory>("kabul");
  const [templateId, setTemplateId] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [caseCode, setCaseCode] = useState("Pdt.G");
  const [caseYear, setCaseYear] = useState(String(new Date().getFullYear()));
  const [caseSatker, setCaseSatker] = useState("PA.Dgl");
  const [caseTypeFilter, setCaseTypeFilter] = useState("");
  const [lastTemplateId, setLastTemplateId] = useState("");
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [selectedCase, setSelectedCase] = useState<CaseSummary | null>(null);
  const [bundle, setBundle] = useState<CaseBundle | null>(null);
  const [selectedHearingIndex, setSelectedHearingIndex] = useState("");
  const [hearingSelectionMode, setHearingSelectionMode] = useState<"none" | "manual">("none");
  const [preview, setPreview] = useState<DocumentPreview | null>(null);
  const [generated, setGenerated] = useState<GeneratedDocument | null>(null);
  const [previewDocument, setPreviewDocument] = useState<GeneratedDocument | null>(null);
  const [showPreviewDocumentModal, setShowPreviewDocumentModal] = useState(false);
  const [variableStatusFilter, setVariableStatusFilter] = useState<VariableFilter>("all");
  const [variableTypeFilter, setVariableTypeFilter] = useState("all");
  const [variableSearch, setVariableSearch] = useState("");
  const [showUnknownDetails, setShowUnknownDetails] = useState(false);
  const [editingVariableKey, setEditingVariableKey] = useState("");
  const [inlineEditingKey, setInlineEditingKey] = useState("");
  const [inlineValue, setInlineValue] = useState("");
  const [manualValue, setManualValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [caseSearchBusy, setCaseSearchBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [downloadNotice, setDownloadNotice] = useState("");
  const caseSearchSequenceRef = useRef(0);

  useEffect(() => {
    if (!canPreview) return;
    const timer = window.setTimeout(() => {
      void fetch(apiPath("/api/judicia/legal-form/categories"), {
        cache: "no-store",
        credentials: "include",
        headers: SILENT_JLF_HEADERS,
      })
        .then((response) => readApi<{ items: CategoryItem[] }>(response))
        .then((data) => setCategories(data.items ?? []))
        .catch(() => setCategories([]));

      void fetch(apiPath("/api/judicia/legal-form/templates?status=active&limit=200"), {
        cache: "no-store",
        credentials: "include",
        headers: SILENT_JLF_HEADERS,
      })
        .then((response) => readApi<{ items: TemplateItem[] }>(response))
        .then((data) => {
          const items = (data.items ?? []).filter((template) => template.status === "active");
          const storedTemplateId = window.localStorage.getItem(LAST_TEMPLATE_STORAGE_KEY) ?? "";
          const preferredTemplateId = storedTemplateId && items.some((item) => item.id === storedTemplateId) ? storedTemplateId : items[0]?.id ?? "";
          setTemplates(items);
          setLastTemplateId(storedTemplateId);
          setTemplateId((current) => current || preferredTemplateId);
        })
        .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Template aktif belum dapat dimuat."));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [canPreview]);

  const filteredTemplates = useMemo(() => {
    const base = templates.filter((template) => {
      const statusOk = template.status === "active";
      const categoryOk = !categoryId || template.categoryId === categoryId;
      return statusOk && categoryOk;
    });
    const byDecision = base.filter((template) => classifyTemplateDecision(template) === decisionCategory);
    const visible = byDecision.length ? byDecision : base;
    return [...visible].sort((left, right) => {
      const leftDecision = classifyTemplateDecision(left);
      const rightDecision = classifyTemplateDecision(right);
      const leftRank = leftDecision === decisionCategory ? 0 : leftDecision === "kabul" ? 1 : 2;
      const rightRank = rightDecision === decisionCategory ? 0 : rightDecision === "kabul" ? 1 : 2;
      return leftRank - rightRank || left.name.localeCompare(right.name);
    });
  }, [categoryId, decisionCategory, templates]);

  useEffect(() => {
    if (!templates.length) return;
    if (templateId && filteredTemplates.some((template) => template.id === templateId)) return;
    const timer = window.setTimeout(() => {
      setTemplateId(filteredTemplates[0]?.id ?? "");
    }, 0);

    return () => window.clearTimeout(timer);
  }, [filteredTemplates, templateId, templates.length]);

  const selectedTemplate = useMemo(() => templates.find((item) => item.id === templateId), [templateId, templates]);
  const hearingOptions = bundle?.schedule ?? [];
  const selectedHearing = selectedHearingIndex ? hearingOptions[Number(selectedHearingIndex)] : undefined;
  const hearingContext = useMemo(
    () => buildJlfHearingContext(bundle?.schedule ?? [], selectedHearing, bundle?.lastHearing, bundle?.nextHearing, { autoSelect: false }),
    [bundle?.lastHearing, bundle?.nextHearing, bundle?.schedule, selectedHearing]
  );
  const hearingStatusLabel = useMemo(() => {
    if (!bundle) return "Belum memuat perkara";
    if (!hearingOptions.length) return "Tidak ada jadwal SIPP";
    if (!selectedHearingIndex) return "Belum dipilih";
    return hearingSelectionMode === "manual" ? "Dipilih manual" : "Belum dipilih";
  }, [bundle, hearingOptions.length, hearingSelectionMode, selectedHearingIndex]);
  const searchNomorPerkara = useMemo(() => {
    const number = caseNumber.trim();
    if (!number) return "";
    if (number.includes("/")) return number;
    return [number, caseCode, caseYear, caseSatker.trim()].filter(Boolean).join("/");
  }, [caseCode, caseNumber, caseSatker, caseYear]);
  const nomorPerkara = selectedCase?.nomorPerkara || searchNomorPerkara;
  const canRender = selectedTemplate?.fileType === "rtf";
  const documentDownloadUrl = generated ? apiPath(`/api/judicia/legal-form/documents/${encodeURIComponent(generated.id)}/download`) : "";
  const previewDocumentDownloadUrl = previewDocument ? apiPath(`/api/judicia/legal-form/documents/${encodeURIComponent(previewDocument.id)}/download`) : "";
  const filteredPreviewVariables = useMemo(() => {
    const query = variableSearch.trim().toLowerCase();
    return (preview?.variables ?? []).filter((variable) => {
      const statusOk = variableFilterMatches(variable, variableStatusFilter);
      const typeOk = variableTypeFilter === "all" || variableTypeKey(variable) === variableTypeFilter;
      const text = [
        variable.legacyCode,
        variable.key,
        variable.label,
        variable.placeholder,
        sourceLabel(variable),
        variableTypeLabel(variable),
        getLegacyAbtTypeLabel(variable.legacyAbtType),
        getJlfFieldModeLabel(variable.fieldMode),
        stringifyValue(variable.value),
        warningLabel(variable),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return statusOk && typeOk && (!query || text.includes(query));
    });
  }, [preview, variableSearch, variableStatusFilter, variableTypeFilter]);
  const reviewStatusCounts = useMemo(() => {
    const counts: Record<JlfReviewStatus, number> = { sipp: 0, manual: 0, empty: 0, needs_review: 0, computed: 0 };
    for (const variable of preview?.variables ?? []) {
      counts[getVariableStatus(variable)] += 1;
    }
    return counts;
  }, [preview]);
  const variableTypeOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const variable of preview?.variables ?? []) {
      map.set(variableTypeKey(variable), variableTypeLabel(variable));
    }
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [preview]);
  const unknownDetails = useMemo(
    () => (preview?.unknownPlaceholders ?? []).map((item, index) => unknownPlaceholderDetail(item, index)),
    [preview]
  );
  const editingVariable = useMemo(
    () => preview?.variables.find((variable) => variable.key === editingVariableKey) ?? null,
    [editingVariableKey, preview]
  );
  const editingValueType = getManualValueType(editingVariable);
  const variableStats = useMemo(() => {
    const variables = preview?.variables ?? [];
    const total = variables.length;
    const filled = variables.filter((variable) => !isEmptyResolvedValue(variable.value)).length;
    const requiredEmpty = preview?.missingRequiredVariables.length ?? 0;
    const unknown = preview?.unknownPlaceholders.length ?? 0;
    const needsReview = reviewStatusCounts.needs_review + unknown;
    const validationLabel = requiredEmpty || unknown
      ? "Perlu dicek"
      : reviewStatusCounts.empty || needsReview
        ? "Cek opsional"
        : "Siap buat draft";
    const validationTone = requiredEmpty || unknown ? "warning" : reviewStatusCounts.empty || needsReview ? "outline" : "success";

    return { total, filled, requiredEmpty, unknown, validationLabel, validationTone };
  }, [preview, reviewStatusCounts]);
  const previewRequiresHearing = useMemo(() => {
    return (preview?.variables ?? []).some((variable) => {
      const text = [
        variable.sourceType,
        variable.source,
        variable.legacyAbtType,
        variable.fieldMode,
        variable.key,
        variable.label,
      ].filter(Boolean).join(" ").toLowerCase();
      return text.includes("sipp_jadwal_sidang") || text.includes("multi_sidang") || text.includes("sidang");
    });
  }, [preview]);
  const hearingSelectionReady = !previewRequiresHearing || Boolean(selectedHearingIndex);
  const quickSteps = [
    { label: "1 Template", done: Boolean(templateId), active: !templateId },
    { label: "2 Perkara", done: Boolean(selectedCase), active: Boolean(templateId) && !selectedCase },
    {
      label: "3 Sidang",
      done: !previewRequiresHearing ? Boolean(bundle) : Boolean(selectedHearingIndex),
      active: Boolean(selectedCase) && !preview,
    },
    { label: "4 Review Variabel", done: Boolean(preview), active: Boolean(preview) && !generated },
    { label: "5 Buat Draft", done: Boolean(generated), active: Boolean(generated) },
  ];

  function beginManualEdit(variable: DocumentPreview["variables"][number]) {
    setInlineEditingKey("");
    setInlineValue("");
    setEditingVariableKey(variable.key);
    setManualValue(getManualInitialValue(variable));
  }

  function closeManualEdit() {
    setEditingVariableKey("");
    setManualValue("");
  }

  function beginInlineEdit(variable: DocumentPreview["variables"][number]) {
    if (!canManual || variable.manualOverrideAllowed === false) return;
    closeManualEdit();
    setInlineEditingKey(variable.key);
    setInlineValue(getManualInitialValue(variable));
  }

  function cancelInlineEdit() {
    setInlineEditingKey("");
    setInlineValue("");
  }

  function clearGeneratedOutputs() {
    setGenerated(null);
    setPreviewDocument(null);
    setShowPreviewDocumentModal(false);
  }

  function chooseTemplate(nextTemplateId: string) {
    const template = templates.find((item) => item.id === nextTemplateId);
    setTemplateId(nextTemplateId);
    if (template) {
      if (template.categoryId) setCategoryId(template.categoryId);
      window.localStorage.setItem(LAST_TEMPLATE_STORAGE_KEY, template.id);
      setLastTemplateId(template.id);
    }
    setPreview(null);
    clearGeneratedOutputs();
    if (selectedCase && nextTemplateId) {
      void previewVariablesFor({
        templateIdOverride: nextTemplateId,
        caseItem: selectedCase,
        nomorPerkaraOverride: selectedCase.nomorPerkara,
        selectedHearingOverride: selectedHearing,
      });
    }
  }

  async function searchCases(options: { auto?: boolean } = {}) {
    const auto = Boolean(options.auto);
    const sequence = ++caseSearchSequenceRef.current;
    if (auto) {
      setCaseSearchBusy(true);
    } else {
      setBusy(true);
      setCaseSearchBusy(false);
      setMessage("");
      setCases([]);
      setSelectedCase(null);
      setBundle(null);
      setPreview(null);
      clearGeneratedOutputs();
      setSelectedHearingIndex("");
      setHearingSelectionMode("none");
    }
    try {
      const params = new URLSearchParams({ nomorPerkara: searchNomorPerkara, limit: "10" });
      if (caseTypeFilter) params.set("caseType", caseTypeFilter);
      if (!caseNumber.includes("/") && caseYear) params.set("year", caseYear);
      const data = await readApi<{ provider: string; items: CaseSummary[] }>(
        await fetch(apiPath(`/api/judicia/legal-form/cases/search?${params.toString()}`), {
          cache: "no-store",
          credentials: "include",
          headers: SILENT_JLF_HEADERS,
        })
      );
      if (sequence !== caseSearchSequenceRef.current) return;
      const nextItems = (data.items ?? []).filter((item) => caseMatchesType(item, caseTypeFilter));
      setCases(nextItems);
      if (!auto) setMessage(nextItems.length ? "" : `Tidak ada hasil dari provider ${data.provider}.`);
    } catch (error) {
      if (!auto) setMessage(error instanceof Error ? error.message : "Pencarian perkara belum berhasil.");
    } finally {
      if (auto) {
        if (sequence === caseSearchSequenceRef.current) setCaseSearchBusy(false);
      } else {
        setBusy(false);
      }
    }
  }

  useEffect(() => {
    if (!canSearch || searchNomorPerkara.length < CASE_SEARCH_MIN_LENGTH) {
      const timer = window.setTimeout(() => {
        setCases([]);
        setCaseSearchBusy(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => {
      void searchCases({ auto: true });
    }, 350);
    return () => window.clearTimeout(timer);
    // searchCases is intentionally invoked from the latest render through the debounce above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSearch, caseTypeFilter, searchNomorPerkara]);

  async function chooseCase(item: CaseSummary) {
    setBusy(true);
    setMessage("");
    setSelectedCase(item);
    setPreview(null);
    clearGeneratedOutputs();
    try {
      const data = await readApi<CaseBundle>(
        await fetch(apiPath(`/api/judicia/legal-form/cases/${encodeURIComponent(item.nomorPerkara)}`), {
          cache: "no-store",
          credentials: "include",
          headers: SILENT_JLF_HEADERS,
        })
      );
      const sortedSchedule = sortJlfHearings(data.schedule ?? []);
      const nextBundle = { ...data, schedule: sortedSchedule };
      setBundle(nextBundle);
      setSelectedHearingIndex("");
      setHearingSelectionMode("none");
      setDecisionCategory(classifyCaseDecision(item, nextBundle) ?? "kabul");
      const warnings = nextBundle.diagnostics?.warnings?.filter(Boolean) ?? [];
      if (warnings.length > 0) setMessage(`Sebagian data SIPP belum terbaca: ${warnings[0]}`);
      if (!caseTypeFilter && item.jenisPerkara) {
        setCaseTypeFilter(findJlfCaseTypeOption(item.jenisPerkara)?.value ?? item.jenisPerkara);
      }
    } catch (error) {
      setBundle({ detail: item, schedule: [] });
      setHearingSelectionMode("none");
      setMessage(error instanceof Error ? error.message : "Detail perkara belum dapat dimuat; preview tetap dapat dicoba.");
    } finally {
      setBusy(false);
    }
    if (templateId) {
      await previewVariablesFor({
        caseItem: item,
        nomorPerkaraOverride: item.nomorPerkara,
        selectedHearingOverride: undefined,
      });
    }
  }

  async function previewVariablesFor(options: {
    templateIdOverride?: string;
    caseItem?: CaseSummary | null;
    nomorPerkaraOverride?: string;
    selectedHearingOverride?: unknown;
  } = {}) {
    const nextTemplateId = options.templateIdOverride ?? templateId;
    const nextCase = options.caseItem ?? selectedCase;
    const nextNomorPerkara = options.nomorPerkaraOverride ?? nextCase?.nomorPerkara ?? nomorPerkara;
    if (!nextTemplateId || !nextNomorPerkara) {
      setMessage("Pilih blangko dan perkara terlebih dahulu.");
      return;
    }

    setBusy(true);
    setMessage("");
    setPreview(null);
    clearGeneratedOutputs();
    try {
      const data = await readApi<DocumentPreview>(
        await fetch(apiPath("/api/judicia/legal-form/documents/preview"), {
          method: "POST",
          credentials: "include",
          headers: JSON_SILENT_JLF_HEADERS,
          body: JSON.stringify({
            templateId: nextTemplateId,
            nomorPerkara: nextNomorPerkara,
            sippPerkaraId: nextCase?.perkaraId,
            selectedHearing: Object.prototype.hasOwnProperty.call(options, "selectedHearingOverride") ? options.selectedHearingOverride : selectedHearing,
          }),
        })
      );
      setPreview(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Pratinjau variabel belum berhasil.");
    } finally {
      setBusy(false);
    }
  }

  async function previewVariables() {
    await previewVariablesFor();
  }

  async function chooseHearingIndex(nextIndex: string) {
    setSelectedHearingIndex(nextIndex);
    setHearingSelectionMode(nextIndex ? "manual" : "none");
    const nextHearing = nextIndex ? bundle?.schedule?.[Number(nextIndex)] : undefined;
    if (selectedCase && templateId) {
      await previewVariablesFor({
        caseItem: selectedCase,
        nomorPerkaraOverride: selectedCase.nomorPerkara,
        selectedHearingOverride: nextHearing,
      });
    } else {
      setPreview(null);
      clearGeneratedOutputs();
    }
  }

  async function writeManualValue(variableKey: string, valueText: string, valueType: string) {
    await readApi(
      await fetch(apiPath(`/api/judicia/legal-form/cases/${encodeURIComponent(nomorPerkara)}/manual-values`), {
        method: "POST",
        credentials: "include",
        headers: JSON_SILENT_JLF_HEADERS,
        body: JSON.stringify({
          templateId,
          sippPerkaraId: selectedCase?.perkaraId,
          variableKey,
          valueText,
          valueType,
        }),
      })
    );
  }

  async function saveManualValue() {
    if (!editingVariableKey) return;
    const nextVariableKey = editingVariableKey;
    const nextValue = manualValue;
    const nextValueType = getManualValueType(editingVariable);
    setBusy(true);
    setMessage("");
    try {
      await writeManualValue(nextVariableKey, nextValue, nextValueType);
      setMessage("Nilai manual disimpan dan dicatat di audit.");
      closeManualEdit();
      await previewVariables();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nilai manual belum dapat disimpan.");
    } finally {
      setBusy(false);
    }
  }

  async function commitInlineEdit(variable: DocumentPreview["variables"][number]) {
    if (inlineEditingKey !== variable.key) return;
    const nextValue = inlineValue;
    const nextValueType = getManualValueType(variable);
    cancelInlineEdit();
    setBusy(true);
    setMessage("");
    try {
      await writeManualValue(variable.key, nextValue, nextValueType);
      setMessage("Nilai variabel disimpan.");
      await previewVariables();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nilai variabel belum dapat disimpan.");
    } finally {
      setBusy(false);
    }
  }

  async function resetManualValue(variable: DocumentPreview["variables"][number]) {
    if (!variable.key) return;
    setBusy(true);
    setMessage("");
    try {
      await readApi(
        await fetch(apiPath(`/api/judicia/legal-form/cases/${encodeURIComponent(nomorPerkara)}/manual-values`), {
          method: "DELETE",
          credentials: "include",
          headers: JSON_SILENT_JLF_HEADERS,
          body: JSON.stringify({
            templateId,
            variableKey: variable.key,
          }),
        })
      );
      setMessage("Perubahan manual dihapus. Nilai akan diambil ulang dari SIPP/fungsi saat pratinjau berikutnya.");
      await previewVariables();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Perubahan manual belum dapat dihapus.");
    } finally {
      setBusy(false);
    }
  }

  async function generateDraft() {
    if (!hearingSelectionReady) {
      setMessage("Pilih sidang terlebih dahulu agar variabel ABT multi-sidang dan hijriah terisi benar.");
      return;
    }
    setBusy(true);
    setMessage("");
    setPreviewDocument(null);
    setShowPreviewDocumentModal(false);
    try {
      const document = await readApi<GeneratedDocument>(
        await fetch(apiPath("/api/judicia/legal-form/documents/generate"), {
          method: "POST",
          credentials: "include",
          headers: JSON_SILENT_JLF_HEADERS,
          body: JSON.stringify({ templateId, nomorPerkara, sippPerkaraId: selectedCase?.perkaraId, selectedHearing, mode: "generate_draft" }),
        })
      );
      setGenerated(document);
      setMessage("Draft dokumen berhasil dibuat.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Pembuatan dokumen belum berhasil.");
    } finally {
      setBusy(false);
    }
  }

  async function generatePreviewDocument() {
    if (!hearingSelectionReady) {
      setMessage("Pilih sidang terlebih dahulu sebelum membuat mode preview blangko.");
      return;
    }
    setBusy(true);
    setMessage("");
    setPreviewDocument(null);
    setShowPreviewDocumentModal(false);
    try {
      const document = await readApi<GeneratedDocument>(
        await fetch(apiPath("/api/judicia/legal-form/documents/generate"), {
          method: "POST",
          credentials: "include",
          headers: JSON_SILENT_JLF_HEADERS,
          body: JSON.stringify({ templateId, nomorPerkara, sippPerkaraId: selectedCase?.perkaraId, selectedHearing, mode: "preview" }),
        })
      );
      setPreviewDocument(document);
      setShowPreviewDocumentModal(true);
      setMessage("Mode preview blangko berhasil dibuat. Periksa pop-up sebelum download.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Mode preview blangko belum berhasil.");
    } finally {
      setBusy(false);
    }
  }

  async function submitValidation() {
    if (!generated) return;
    setBusy(true);
    setMessage("");
    try {
      await readApi(
        await fetch(apiPath(`/api/judicia/legal-form/documents/${encodeURIComponent(generated.id)}/submit-validation`), {
          method: "POST",
          credentials: "include",
          headers: JSON_SILENT_JLF_HEADERS,
          body: JSON.stringify({ comment: "Diajukan dari Mode Cepat Blangko." }),
        })
      );
      setGenerated((current) => current ? { ...current, status: "waiting_validation" } : current);
      setMessage("Draft diajukan ke validasi.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Submit validasi belum berhasil.");
    } finally {
      setBusy(false);
    }
  }

  if (!canSearch && !canPreview) return null;

  return (
    <Card className="border-border/80">
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Mode Cepat Blangko
            </CardTitle>
            <CardDescription>
              Pilih blangko, perkara, sidang, review variabel, lalu buat draft.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">ABT-compatible</Badge>
            <Badge variant="success">Authorized</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 overflow-hidden">
        {message ? <div className="rounded-xl border border-border/80 bg-muted/30 p-3 text-sm text-muted-foreground">{message}</div> : null}

        <div className="grid gap-2 md:grid-cols-5">
          {quickSteps.map((step) => (
            <div
              key={step.label}
              className={`rounded-xl border px-3 py-2 text-sm ${
                step.done
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                  : step.active
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-border/80 bg-muted/20 text-muted-foreground"
              }`}
            >
              <div className="flex items-center gap-2">
                {step.done ? <CheckCircle2 className="h-4 w-4" /> : <span className="h-2 w-2 rounded-full bg-current opacity-60" />}
                <span className="font-medium">{step.label}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-3 lg:grid-cols-[220px_220px_minmax(0,1fr)]">
          <NativeSelect value={categoryId} onChange={(event) => {
            setCategoryId(event.target.value);
            setTemplateId("");
          }} disabled={!canPreview}>
            <option value="">Semua kategori</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </NativeSelect>
          <NativeSelect value={decisionCategory} onChange={(event) => {
            setDecisionCategory(event.target.value as DecisionCategory);
            setTemplateId("");
          }} disabled={!canPreview}>
            {DECISION_CATEGORIES.map((category) => (
              <option key={category.value} value={category.value}>{category.label}</option>
            ))}
          </NativeSelect>
          <NativeSelect value={templateId} onChange={(event) => chooseTemplate(event.target.value)} disabled={!canPreview || filteredTemplates.length === 0}>
            <option value="">{filteredTemplates.length ? "Pilih blangko" : "Tidak ada blangko cocok"}</option>
            {filteredTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} ({template.fileType.toUpperCase()}) - {template.categoryName || "Tanpa kategori"} - {template.status}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="rounded-xl border border-border/80 bg-muted/20 p-3 text-sm text-muted-foreground">
          {selectedTemplate ? (
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold text-foreground">{selectedTemplate.name}</p>
                <p>
                  {selectedTemplate.categoryName || "Tanpa kategori"} - {selectedTemplate.fileType.toUpperCase()} - {selectedTemplate.documentType || "legal_form"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={templateStatusVariant(selectedTemplate.status)}>{selectedTemplate.status}</Badge>
                {selectedTemplate.requiresValidation ? <Badge variant="outline">Perlu validasi</Badge> : null}
                <Badge variant={selectedTemplate.supportsAi ? "warning" : "outline"}>{selectedTemplate.supportsAi ? "AI Template ON" : "AI Template OFF"}</Badge>
                {lastTemplateId && templates.some((template) => template.id === lastTemplateId) ? (
                  <Button type="button" size="sm" variant="ghost" onClick={() => chooseTemplate(lastTemplateId)}>
                    Pakai Terakhir
                  </Button>
                ) : null}
                <Button asChild size="sm" variant="outline">
                  <Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/templates/${encodeURIComponent(selectedTemplate.id)}`}>
                    Detail Blangko
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <p>
              Belum ada template/blangko yang cocok. Ubah kategori atau aktifkan/unggah template dari menu Template Dokumen.
            </p>
          )}
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_120px_120px_120px_auto]">
          <Input
            list="jlf-case-suggestions"
            value={caseNumber}
            onChange={(event) => {
              const nextValue = event.target.value;
              const matchedCase = cases.find((item) => item.nomorPerkara === nextValue);
              setCaseNumber(nextValue);
              setSelectedCase(null);
              setBundle(null);
              setPreview(null);
              clearGeneratedOutputs();
              setSelectedHearingIndex("");
              setHearingSelectionMode("none");
              if (matchedCase) {
                window.setTimeout(() => void chooseCase(matchedCase), 0);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && searchNomorPerkara.length >= CASE_SEARCH_MIN_LENGTH && !busy) void searchCases();
            }}
            placeholder="Nomor perkara atau nomor lengkap"
            disabled={!canSearch}
          />
          <datalist id="jlf-case-suggestions">
            {cases.map((item) => (
              <option key={`suggest-${item.perkaraId}-${item.nomorPerkara}`} value={item.nomorPerkara}>
                {[item.jenisPerkara, cleanDisplayText(item.paraPihak || "")].filter(Boolean).join(" - ")}
              </option>
            ))}
          </datalist>
          <NativeSelect value={caseCode} onChange={(event) => setCaseCode(event.target.value)} disabled={!canSearch || caseNumber.includes("/")}>
            {JLF_CASE_NUMBER_CODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </NativeSelect>
          <Input
            value={caseYear}
            onChange={(event) => setCaseYear(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && searchNomorPerkara.length >= CASE_SEARCH_MIN_LENGTH && !busy) void searchCases();
            }}
            placeholder="Tahun"
            disabled={!canSearch || caseNumber.includes("/")}
          />
          <Input
            value={caseSatker}
            onChange={(event) => setCaseSatker(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && searchNomorPerkara.length >= CASE_SEARCH_MIN_LENGTH && !busy) void searchCases();
            }}
            placeholder="PA"
            disabled={!canSearch || caseNumber.includes("/")}
          />
          <Button type="button" variant="outline" disabled={busy || caseSearchBusy || !canSearch || searchNomorPerkara.length < CASE_SEARCH_MIN_LENGTH} onClick={() => void searchCases()}>
            <Search className="h-4 w-4" />
            Cari
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-[240px_minmax(0,1fr)]">
          <NativeSelect
            value={caseTypeFilter}
            onChange={(event) => {
              const value = event.target.value;
              setCaseTypeFilter(value);
              if (value) setCaseCode(inferJlfCaseNumberCode(value));
            }}
            disabled={!canSearch}
          >
            <option value="">Semua jenis perkara</option>
            {JLF_CASE_TYPE_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.options.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </optgroup>
            ))}
          </NativeSelect>
          <div className="flex min-h-11 items-center rounded-xl border border-border/80 bg-muted/20 px-3 text-sm text-muted-foreground">
            {caseSearchBusy ? "Mencari otomatis..." : "Pilih jenis perkara untuk mengisi kode nomor otomatis. Nomor perkara akan memberi saran otomatis saat minimal 1 karakter."}
          </div>
        </div>

        {cases.length ? (
          <div className="max-w-full overflow-x-auto rounded-xl border border-border/80">
            <table className="w-full min-w-[720px] table-fixed text-left text-sm">
              <thead className="border-b border-border text-muted-foreground">
                <tr>
                  <th className="w-[28%] px-3 py-3 font-medium">Nomor perkara</th>
                  <th className="w-[16%] px-3 py-3 font-medium">Jenis</th>
                  <th className="px-3 py-3 font-medium">Para pihak</th>
                  <th className="w-[14%] px-3 py-3 font-medium">Status</th>
                  <th className="w-[96px] px-3 py-3 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((item) => {
                  const active = selectedCase?.nomorPerkara === item.nomorPerkara;
                  return (
                    <tr
                      key={`${item.perkaraId}-${item.nomorPerkara}`}
                      role="button"
                      tabIndex={0}
                      className={`cursor-pointer border-b border-border/70 transition hover:bg-primary/5 ${active ? "bg-primary/10" : ""}`}
                      onClick={() => {
                        if (!busy) void chooseCase(item);
                      }}
                      onKeyDown={(event) => {
                        if ((event.key === "Enter" || event.key === " ") && !busy) {
                          event.preventDefault();
                          void chooseCase(item);
                        }
                      }}
                    >
                      <td className="px-3 py-3 font-medium text-foreground">{item.nomorPerkara}</td>
                      <td className="px-3 py-3 text-muted-foreground">{item.jenisPerkara || "-"}</td>
                      <td className="px-3 py-3 text-muted-foreground">
                        <div className="line-clamp-3 break-words">
                          {canViewSensitive ? cleanDisplayText(item.paraPihak || "-") : maskSensitiveText(cleanDisplayText(item.paraPihak || "-"))}
                        </div>
                      </td>
                      <td className="px-3 py-3"><Badge variant="outline">{item.statusPerkara || item.tahapan || "-"}</Badge></td>
                      <td className="px-3 py-3">
                        <Badge variant={active ? "success" : "outline"}>{active ? "Aktif" : "Klik baris"}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto]">
          <div className="rounded-xl border border-border/80 bg-muted/20 p-2">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Sidang dipakai</p>
              <Badge variant={selectedHearingIndex ? "success" : "outline"}>{hearingStatusLabel}</Badge>
            </div>
            {!bundle ? (
              <p className="px-1 pt-2 text-sm text-muted-foreground">Pilih perkara untuk memuat jadwal sidang dari SIPP.</p>
            ) : hearingOptions.length ? (
              <div className="mt-2 grid max-h-40 gap-2 overflow-y-auto sm:grid-cols-2 2xl:grid-cols-3">
                <button
                  type="button"
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                    !selectedHearingIndex ? "border-primary/60 bg-primary/10 text-foreground" : "border-border/70 bg-background/30 text-muted-foreground hover:border-primary/40"
                  }`}
                  disabled={busy}
                  aria-pressed={!selectedHearingIndex}
                  onClick={() => void chooseHearingIndex("")}
                >
                  <span className="block font-semibold">Belum dipilih</span>
                  <span className="mt-0.5 block text-xs">Pilih salah satu sidang agar variabel ABT multi-sidang terisi.</span>
                </button>
                {hearingOptions.map((item, index) => {
                  const summary = hearingSummary(item, index);
                  const active = selectedHearingIndex === String(index);
                  return (
                    <button
                      key={`quick-hearing-${index}`}
                      type="button"
                      className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                        active ? "border-primary/60 bg-primary/10 text-foreground" : "border-border/70 bg-background/30 text-muted-foreground hover:border-primary/40"
                      }`}
                      disabled={busy}
                      aria-pressed={active}
                      title={hearingLabel(item, index)}
                      onClick={() => void chooseHearingIndex(String(index))}
                    >
                      <span className="block font-semibold">Sidang {summary.order}</span>
                      <span className="mt-0.5 block text-xs">{[summary.date, summary.time].filter(Boolean).join(" ") || "Tanggal belum terbaca"}</span>
                      <span className="mt-1 line-clamp-2 text-xs">{summary.agenda || "Agenda belum terbaca"}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="px-1 pt-2 text-sm text-muted-foreground">
                Tidak ada jadwal sidang dari SIPP. Variabel sidang dibiarkan kosong sampai jadwal tersedia.
              </p>
            )}
          </div>
          <Button type="button" variant="outline" disabled={busy || !templateId || !nomorPerkara} onClick={previewVariables}>
            <RefreshCw className="h-4 w-4" />
            Muat Pratinjau
          </Button>
          <Button type="button" variant="outline" disabled={busy || !canGenerate || !preview || !hearingSelectionReady || Boolean(preview.missingRequiredVariables.length) || !canRender} onClick={generatePreviewDocument}>
            <Eye className="h-4 w-4" />
            Mode Preview
          </Button>
          <Button type="button" disabled={busy || !canGenerate || !preview || !hearingSelectionReady || Boolean(preview.missingRequiredVariables.length) || !canRender} onClick={generateDraft}>
            <Send className="h-4 w-4" />
            Buat Draft
          </Button>
          <Button asChild variant="outline">
            <Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/cases/${encodeURIComponent(nomorPerkara || "nomor-perkara")}/generate${templateId ? `?templateId=${encodeURIComponent(templateId)}` : ""}`}>
              Wizard
            </Link>
          </Button>
        </div>

        {bundle ? (
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { title: "Sidang Sebelumnya", item: hearingContext.previous, variant: "outline" as const },
              { title: "Sidang Terpilih", item: hearingContext.selected, variant: "success" as const },
              { title: "Sidang Berikutnya", item: hearingContext.next, variant: "outline" as const },
            ].map((slot) => (
              <div key={slot.title} className="rounded-xl border border-border/80 bg-muted/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{slot.title}</p>
                  <Badge variant={slot.variant}>{slot.item ? `Sidang ${slot.item.order}` : "-"}</Badge>
                </div>
                {slot.item ? (
                  <div className="mt-2 space-y-1 text-sm">
                    <p className="font-medium text-foreground">{[slot.item.date, slot.item.time].filter(Boolean).join(" ") || "-"}</p>
                    <p className="line-clamp-2 text-muted-foreground">{slot.item.agenda || "Agenda belum terbaca"}</p>
                    {slot.item.room || slot.item.status ? (
                      <p className="text-xs text-muted-foreground">{[slot.item.room, slot.item.status].filter(Boolean).join(" - ")}</p>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">Tidak ada data dari jadwal SIPP.</p>
                )}
              </div>
            ))}
          </div>
        ) : null}

        {preview ? (
          <div className="min-w-0 space-y-3">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              <button
                type="button"
                className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2 text-left transition hover:border-primary/40"
                onClick={() => setVariableStatusFilter("all")}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Variabel</p>
                <p className="mt-0.5 text-lg font-semibold text-foreground">{variableStats.total}</p>
              </button>
              <button
                type="button"
                className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-left transition hover:border-emerald-400/70"
                onClick={() => setVariableStatusFilter("filled")}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-200">Terisi</p>
                <p className="mt-0.5 text-lg font-semibold text-foreground">{variableStats.filled}</p>
              </button>
              <button
                type="button"
                className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-left transition hover:border-amber-400/70"
                onClick={() => setVariableStatusFilter("required_empty")}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-800 dark:text-amber-100">Wajib kosong</p>
                <p className="mt-0.5 text-lg font-semibold text-foreground">{variableStats.requiredEmpty}</p>
              </button>
              <button
                type="button"
                className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-left transition hover:border-sky-400/70 disabled:cursor-default disabled:hover:border-sky-500/30"
                disabled={variableStats.unknown === 0}
                onClick={() => {
                  setShowUnknownDetails(true);
                  setVariableStatusFilter("unknown");
                }}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-800 dark:text-sky-100">Tidak dikenali</p>
                <p className="mt-0.5 text-lg font-semibold text-foreground">{variableStats.unknown}</p>
              </button>
              <div className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Validasi</p>
                <Badge
                  className="mt-1"
                  variant={variableStats.validationTone === "warning" ? "warning" : variableStats.validationTone === "success" ? "success" : "outline"}
                >
                  {variableStats.validationLabel}
                </Badge>
              </div>
            </div>

            {showUnknownDetails && unknownDetails.length ? (
              <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Placeholder tidak dikenali</p>
                    <p className="text-xs text-muted-foreground">Daftar ini membantu admin menemukan mapping, tipe, query, atau handler yang belum lengkap.</p>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={() => setVariableStatusFilter("unknown")}>
                    Tampilkan
                  </Button>
                </div>
                <div className="mt-3 grid gap-2">
                  {unknownDetails.slice(0, 12).map((item) => (
                    <div key={`${item.code}-${item.meta}`} className="rounded-lg border border-border/70 bg-background/40 p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{item.type}</Badge>
                        <span className="font-mono font-semibold text-foreground">{item.code}</span>
                        {item.meta ? <span className="font-mono text-xs text-muted-foreground">{item.meta}</span> : null}
                      </div>
                      <p className="mt-2 text-muted-foreground">{item.reason}</p>
                      <p className="mt-1 text-xs text-sky-900 dark:text-sky-100">{item.source} - {item.recommendation}</p>
                    </div>
                  ))}
                  {unknownDetails.length > 12 ? (
                    <p className="text-xs text-muted-foreground">Masih ada {unknownDetails.length - 12} placeholder tidak dikenali lain. Gunakan filter atau menu variabel untuk review lengkap.</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {(reviewStatusCounts.empty || reviewStatusCounts.needs_review || preview.unknownPlaceholders.length) ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-100">
                <div className="flex gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-semibold">Periksa sebelum buat draft.</p>
                    <p className="mt-1">
                      {reviewStatusCounts.empty} variabel kosong, {reviewStatusCounts.needs_review} perlu review admin,
                      dan {preview.unknownPlaceholders.length} placeholder tidak dikenali. Isi manual jika diperlukan sebelum dokumen dijadikan final.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 rounded-xl border border-border/80 bg-muted/20 p-3 lg:grid-cols-[minmax(0,1fr)_200px_220px_auto]">
              <Input
                value={variableSearch}
                onChange={(event) => setVariableSearch(event.target.value)}
                placeholder="Cari kode, key, label, nilai, atau warning"
              />
              <NativeSelect value={variableStatusFilter} onChange={(event) => setVariableStatusFilter(event.target.value as VariableFilter)}>
                {VARIABLE_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </NativeSelect>
              <NativeSelect value={variableTypeFilter} onChange={(event) => setVariableTypeFilter(event.target.value)}>
                <option value="all">Semua tipe variabel</option>
                {variableTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </NativeSelect>
              <Button type="button" variant="outline" onClick={() => {
                setVariableSearch("");
                setVariableStatusFilter("all");
                setVariableTypeFilter("all");
              }}>
                Reset
              </Button>
            </div>

            <div className="max-w-full overflow-x-auto rounded-xl border border-border/80">
              <table className="w-full min-w-[1040px] table-fixed text-left text-sm">
                <thead className="border-b border-border text-muted-foreground">
                  <tr>
                    <th className="w-[25%] px-3 py-3 font-medium">Variabel</th>
                    <th className="w-[13%] px-3 py-3 font-medium">Placeholder</th>
                    <th className="w-[30%] px-3 py-3 font-medium">Hasil Variabel</th>
                    <th className="w-[22%] px-3 py-3 font-medium">Catatan</th>
                    <th className="w-[10%] px-3 py-3 font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPreviewVariables.map((variable) => {
                    const value = stringifyValue(variable.value);
                    const status = getVariableStatus(variable);
                    const statusMeta = statusBadgeMeta(status);
                    const canEditVariable = canManual && variable.manualOverrideAllowed !== false;
                    const isInlineEditing = inlineEditingKey === variable.key;
                    const needsPanelEdit = prefersInlineTextarea(variable);
                    const displayedValue = canViewSensitive ? value : maskSensitiveText(value || "-");
                    return (
                      <tr key={`${variable.key}-${variable.placeholder}`} className="border-b border-border/70 align-top">
                        <td className="px-3 py-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap gap-1.5">
                              {variable.legacyCode ? <Badge variant="outline">#{variable.legacyCode}#</Badge> : null}
                              <Badge variant="outline">{variableTypeLabel(variable)}</Badge>
                              <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                              {isUnknownVariable(variable) ? <Badge variant="warning">Tidak dikenali</Badge> : null}
                              {variable.manualOverride ? <Badge variant="default">Diubah Manual</Badge> : null}
                              {variable.aiEnabled ? <Badge variant="warning">AI ON</Badge> : null}
                            </div>
                            <p className="break-words font-medium text-foreground">{variable.label || variable.key}</p>
                            <p className="break-all font-mono text-xs text-muted-foreground">{variable.key}</p>
                          </div>
                        </td>
                        <td className="break-all px-3 py-3 font-mono text-xs text-muted-foreground">{variable.placeholder}</td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {isInlineEditing ? (
                            <div className="space-y-1">
                              <Input
                                autoFocus
                                type={getManualValueType(variable) === "number" ? "number" : getManualValueType(variable) === "date" ? "date" : "text"}
                                value={inlineValue}
                                onChange={(event) => setInlineValue(event.target.value)}
                                onBlur={() => void commitInlineEdit(variable)}
                                onKeyDown={(event) => {
                                  if (event.key === "Escape") {
                                    event.preventDefault();
                                    cancelInlineEdit();
                                  }
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    void commitInlineEdit(variable);
                                  }
                                }}
                              />
                              <p className="text-[11px] text-muted-foreground">Enter simpan, Esc batal.</p>
                            </div>
                          ) : canEditVariable ? (
                            <button
                              type="button"
                              className="block max-h-28 w-full overflow-auto rounded-lg border border-transparent p-2 text-left transition hover:border-primary/40 hover:bg-primary/5"
                              onClick={() => needsPanelEdit ? beginManualEdit(variable) : beginInlineEdit(variable)}
                              title={needsPanelEdit ? "Buka panel edit panjang" : "Edit cepat nilai variabel"}
                            >
                              <span className="block whitespace-pre-wrap break-words">{displayedValue || "-"}</span>
                            </button>
                          ) : (
                            <div className="max-h-28 overflow-auto whitespace-pre-wrap break-words">{displayedValue || "-"}</div>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="space-y-2">
                            <Badge variant="outline">{sourceLabel(variable)}</Badge>
                            <p className="break-all font-mono text-xs text-muted-foreground">
                              {variable.sourceType || variable.source || "-"}{variable.dataType ? ` / ${variable.dataType}` : ""}
                            </p>
                            <div className="max-h-24 overflow-auto whitespace-pre-wrap break-words text-xs text-amber-700 dark:text-amber-300">
                              {warningLabel(variable)}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-col gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={!canEditVariable}
                              onClick={() => needsPanelEdit ? beginManualEdit(variable) : beginInlineEdit(variable)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              {needsPanelEdit ? "Panel" : "Edit"}
                            </Button>
                            {status === "manual" ? (
                              <Button type="button" size="sm" variant="outline" disabled={!canManual || busy} onClick={() => void resetManualValue(variable)}>
                                <RotateCcw className="h-3.5 w-3.5" />
                                Reset
                              </Button>
                            ) : null}
                            {canManageVariables ? (
                              <Button asChild size="sm" variant="ghost">
                                <Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/variables?search=${encodeURIComponent(variable.key)}`}>
                                  Lihat Detail
                                </Link>
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredPreviewVariables.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">
                          Tidak ada variabel sesuai filter.
                        </td>
                      </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {editingVariableKey ? (
          <div className="fixed inset-0 z-50 flex justify-end bg-background/70 backdrop-blur-sm">
            <div className="h-full w-full max-w-xl overflow-y-auto border-l border-border bg-card p-5 shadow-panel">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Edit panjang</p>
                  <h3 className="mt-1 font-mono text-lg font-semibold text-foreground">{editingVariableKey}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Nilai ini dipakai untuk perkara dan template terpilih. Perubahan disimpan ke data manual dan dicatat audit.
                  </p>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={closeManualEdit}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {editingVariable ? (
                <div className="mt-4 rounded-xl border border-border/80 bg-muted/20 p-3 text-sm">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline">{variableTypeLabel(editingVariable)}</Badge>
                    <Badge variant={statusBadgeMeta(getVariableStatus(editingVariable)).variant}>{statusBadgeMeta(getVariableStatus(editingVariable)).label}</Badge>
                  </div>
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">Nilai otomatis saat ini</p>
                  <p className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap break-words text-muted-foreground">
                    {canViewSensitive ? stringifyValue(editingVariable.value) || "-" : maskSensitiveText(stringifyValue(editingVariable.value) || "-")}
                  </p>
                </div>
              ) : null}
              {editingValueType === "date" ? (
                <Input
                  className="mt-4"
                  type="date"
                  value={manualValue}
                  onChange={(event) => setManualValue(event.target.value)}
                />
              ) : editingValueType === "number" ? (
                <Input
                  className="mt-4"
                  type="number"
                  value={manualValue}
                  onChange={(event) => setManualValue(event.target.value)}
                  placeholder="Nilai angka"
                />
              ) : (
                <Textarea
                  className="mt-4 min-h-48"
                  value={manualValue}
                  onChange={(event) => setManualValue(event.target.value)}
                  placeholder="Nilai manual"
                />
              )}
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeManualEdit}>
                  Batal
                </Button>
                {editingVariable ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      void resetManualValue(editingVariable);
                      closeManualEdit();
                    }}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset Otomatis
                  </Button>
                ) : null}
                <Button type="button" disabled={busy} onClick={saveManualValue}>
                  Simpan
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {showPreviewDocumentModal && previewDocument ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/75 p-4 backdrop-blur-sm">
            <div className="w-full max-w-xl rounded-xl border border-border bg-card p-5 shadow-panel">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Mode Preview</p>
                  <h3 className="mt-1 text-xl font-semibold text-foreground">Preview blangko siap</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Hasil render sudah dibuat untuk diperiksa dulu. Download dari sini bila isi preview sudah sesuai.
                  </p>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => setShowPreviewDocumentModal(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-4 grid gap-2 rounded-xl border border-border/80 bg-muted/20 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="success">{previewDocument.status}</Badge>
                  <span className="text-muted-foreground">{previewDocument.outputFileType?.toUpperCase() || "RTF"}</span>
                </div>
                <p className="break-words font-medium text-foreground">{previewDocument.templateName || selectedTemplate?.name || "Blangko JLF"}</p>
                <p className="break-words text-muted-foreground">{previewDocument.nomorPerkara || nomorPerkara}</p>
                {previewDocument.metadata?.downloadFileName ? (
                  <p className="break-all font-mono text-xs text-muted-foreground">{String(previewDocument.metadata.downloadFileName)}</p>
                ) : null}
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowPreviewDocumentModal(false)}>
                  Tutup
                </Button>
                <Button asChild variant="outline">
                  <Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/documents/${encodeURIComponent(previewDocument.id)}`}>Detail</Link>
                </Button>
                {canDownload ? (
                  <Button asChild>
                    <a
                      href={previewDocumentDownloadUrl}
                      onClick={() => {
                        setDownloadNotice("Unduhan preview dimulai.");
                        window.setTimeout(() => setDownloadNotice(""), 2500);
                      }}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download Preview
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {generated ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/80 bg-muted/30 p-3 text-sm">
            <Badge variant="success">{generated.status}</Badge>
            <span className="text-muted-foreground">Draft dibuat.</span>
            {canDownload ? (
              <Button asChild size="sm">
                <a href={documentDownloadUrl}>
                  <Download className="h-3.5 w-3.5" />
                  Unduh
                </a>
              </Button>
            ) : null}
            {canSubmitValidation && generated.status !== "waiting_validation" ? (
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={submitValidation}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Ajukan Validasi
              </Button>
            ) : null}
            <Button asChild size="sm" variant="outline">
              <Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/documents/${encodeURIComponent(generated.id)}`}>Detail Dokumen</Link>
            </Button>
          </div>
        ) : null}

        {generated && canDownload ? (
          <div className="fixed bottom-4 right-4 z-40 w-[min(360px,calc(100vw-2rem))] rounded-xl border border-border bg-card/95 p-3 text-sm shadow-panel backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-foreground">Draft siap diunduh</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{downloadNotice || "Tombol unduh tetap terlihat saat halaman digulir."}</p>
              </div>
              <Badge variant="success">{generated.status}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/documents/${encodeURIComponent(generated.id)}`}>Detail</Link>
              </Button>
              <Button asChild size="sm">
                <a
                  href={documentDownloadUrl}
                  onClick={() => {
                    setDownloadNotice("Unduhan dimulai.");
                    window.setTimeout(() => setDownloadNotice(""), 2500);
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                  Unduh
                </a>
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
