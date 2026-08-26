"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bot, FileText, Plus, RefreshCw, Save, Scale, Upload } from "lucide-react";

import { JlfLoadingState } from "@/components/portal/judicia/legal-form/jlf-foundation";
import { AccessDeniedCard, EmptyState, PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { usePortal } from "@/lib/app-state";
import { apiPath } from "@/lib/base-path";
import {
  hasJudiciaLegalFormPermission,
  JLF_PERMISSION,
  JUDICIA_LEGAL_FORM_ROUTE,
  resolveJudiciaLegalFormAccess,
} from "@/lib/judicia-legal-form-types";
import { getEffectiveRoleId, getUserPositionLabel } from "@/lib/permissions";

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { message?: string };
};

type CategoryItem = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
};

type TemplateItem = {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  slug: string;
  description: string;
  documentType: string;
  fileType: string;
  storagePath: string;
  originalFilename: string;
  status: string;
  requiresValidation: boolean;
  supportsAi: boolean;
  supportsWhatsappNotification: boolean;
  updatedAt: string;
};

type TemplateVersion = {
  id: string;
  versionNumber: number;
  storagePath: string;
  checksum: string;
  detectedPlaceholders: PlaceholderItem[];
  changeNote: string;
  createdAt: string;
};

type VariableItem = {
  id: string;
  legacyCode: string | null;
  key: string;
  label: string;
  dataType: string;
  sourceType: string;
  isActive: boolean;
};

type TemplateVariable = {
  id: string;
  variableId: string;
  variableKey: string;
  variableLabel: string;
  placeholder: string;
  isRequired: boolean;
};

type PlaceholderItem = {
  placeholder: string;
  normalizedKey: string;
  kind: "legacy" | "modern";
  count: number;
};

type PlaceholderReport = {
  templateVersionId?: string;
  placeholders: PlaceholderItem[];
  unknownPlaceholders: PlaceholderItem[];
  duplicatePlaceholders: PlaceholderItem[];
  mappedPlaceholders: Array<PlaceholderItem & { variableId: string; variableKey: string; label: string }>;
  parserWarnings: string[];
};

type AccessState = ReturnType<typeof resolveJudiciaLegalFormAccess>;

async function readApi<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error?.message ?? "Permintaan JLF belum berhasil.");
  }
  return payload?.data as T;
}

function useJlfAccess() {
  const { currentUser, positions } = usePortal();
  const access = resolveJudiciaLegalFormAccess(currentUser, {
    effectiveRoleId: getEffectiveRoleId(currentUser),
    positionLabel: getUserPositionLabel(currentUser, positions),
  });

  return { currentUser, access };
}

function statusVariant(status: string) {
  if (status === "active") return "success";
  if (status === "draft") return "warning";
  if (status === "archived") return "muted";
  return "outline";
}

function can(access: AccessState, permission: string) {
  return hasJudiciaLegalFormPermission(access, permission as never);
}

const DOCUMENT_TYPE_OPTIONS = [
  { value: "legal_form", label: "Legal Form Umum" },
  { value: "putusan_cerai_gugat_verstek", label: "Putusan Cerai Gugat - Kabul Verstek" },
  { value: "putusan_cerai_gugat_kontradiktoir", label: "Putusan Cerai Gugat - Kontradiktoir" },
  { value: "putusan_cerai_talak", label: "Putusan Cerai Talak" },
  { value: "penetapan_permohonan", label: "Penetapan Permohonan" },
  { value: "bas", label: "Berita Acara Sidang/BAS" },
  { value: "panggilan_relaas", label: "Panggilan/Relaas" },
  { value: "pemberitahuan", label: "Pemberitahuan" },
  { value: "mediasi", label: "Dokumen Mediasi" },
  { value: "ikrar_talak", label: "Ikrar Talak" },
  { value: "ecourt", label: "e-Court" },
] as const;

function inferDocumentTypeFromName(name: string, currentType: string) {
  if (currentType && currentType !== "legal_form") return currentType;
  const normalized = name.toLocaleLowerCase("id-ID");
  if (normalized.includes("kabul verstek") && normalized.includes("cerai")) return "putusan_cerai_gugat_verstek";
  if (normalized.includes("cerai gugat")) return "putusan_cerai_gugat_kontradiktoir";
  if (normalized.includes("cerai talak")) return "putusan_cerai_talak";
  if (normalized.includes("berita acara") || normalized.includes("bas")) return "bas";
  if (normalized.includes("panggilan") || normalized.includes("relaas")) return "panggilan_relaas";
  if (normalized.includes("pemberitahuan")) return "pemberitahuan";
  if (normalized.includes("mediasi")) return "mediasi";
  if (normalized.includes("ikrar talak")) return "ikrar_talak";
  return currentType || "legal_form";
}

function useCategories(canView: boolean) {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function loadCategories() {
    if (!canView) return;
    setLoading(true);
    try {
      const data = await readApi<{ items: CategoryItem[] }>(
        await fetch(apiPath("/api/judicia/legal-form/categories?includeInactive=true"), {
          cache: "no-store",
          credentials: "include",
        })
      );
      setCategories(data.items ?? []);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat kategori JLF.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canView) return;
    const timer = window.setTimeout(() => {
      setLoading(true);
      void fetch(apiPath("/api/judicia/legal-form/categories?includeInactive=true"), {
        cache: "no-store",
        credentials: "include",
      })
        .then((response) => readApi<{ items: CategoryItem[] }>(response))
        .then((data) => {
          setCategories(data.items ?? []);
          setMessage("");
        })
        .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Gagal memuat kategori JLF."))
        .finally(() => setLoading(false));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [canView]);

  return { categories, loading, message, loadCategories };
}

function TemplateStatusBadge({ status }: { status: string }) {
  return <Badge variant={statusVariant(status)}>{status}</Badge>;
}

export function JlfTemplatesListPage() {
  const { currentUser, access } = useJlfAccess();
  const canView = can(access, JLF_PERMISSION.TEMPLATE_VIEW);
  const canCreate = can(access, JLF_PERMISSION.TEMPLATE_CREATE);
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [filters, setFilters] = useState({ query: "", categoryId: "", status: "" });
  const categoriesState = useCategories(canView);

  async function loadTemplates() {
    if (!canView) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "150" });
      if (filters.query.trim()) params.set("query", filters.query.trim());
      if (filters.categoryId) params.set("categoryId", filters.categoryId);
      if (filters.status) params.set("status", filters.status);
      const data = await readApi<{ items: TemplateItem[] }>(
        await fetch(apiPath(`/api/judicia/legal-form/templates?${params.toString()}`), {
          cache: "no-store",
          credentials: "include",
        })
      );
      setItems(data.items ?? []);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat template JLF.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canView) return;
    const timer = window.setTimeout(() => {
      setLoading(true);
      void fetch(apiPath("/api/judicia/legal-form/templates?limit=150"), {
        cache: "no-store",
        credentials: "include",
      })
        .then((response) => readApi<{ items: TemplateItem[] }>(response))
        .then((data) => {
          setItems(data.items ?? []);
          setMessage("");
        })
        .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Gagal memuat template JLF."))
        .finally(() => setLoading(false));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [canView]);

  if (!currentUser) return <JlfLoadingState />;
  if (!canView) return <AccessDeniedCard />;

  return (
    <div className="space-y-8">
      <PageIntro
        eyebrow="ALETA Judicia"
        title="Template Dokumen"
        description="Kelola metadata template, versi file DOCX/RTF, placeholder, dan mapping variabel JLF."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={JUDICIA_LEGAL_FORM_ROUTE}>
                <ArrowLeft className="h-4 w-4" />
                Dashboard
              </Link>
            </Button>
            {canCreate ? (
              <Button asChild>
                <Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/templates/new`}>
                  <Plus className="h-4 w-4" />
                  Tambah Template
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      {message || categoriesState.message ? (
        <Card className="border-border/80">
          <CardContent className="p-4 text-sm text-muted-foreground">{message || categoriesState.message}</CardContent>
        </Card>
      ) : null}

      <Card className="border-border/80">
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_220px_180px_auto]">
          <Input
            value={filters.query}
            onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
            placeholder="Cari nama, slug, atau deskripsi"
            aria-label="Cari template"
          />
          <NativeSelect
            value={filters.categoryId}
            onChange={(event) => setFilters((current) => ({ ...current, categoryId: event.target.value }))}
            aria-label="Filter kategori"
          >
            <option value="">Semua kategori</option>
            {categoriesState.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            value={filters.status}
            onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
            aria-label="Filter status"
          >
            <option value="">Semua status</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archived</option>
          </NativeSelect>
          <Button type="button" onClick={loadTemplates} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
            Terapkan
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/80">
        <CardHeader>
          <CardTitle>Daftar Template</CardTitle>
          <CardDescription>Template aktif dapat dipakai pada tahap document generation berikutnya.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <JlfLoadingState />
          ) : items.length === 0 ? (
            <EmptyState title="Belum ada template" description="Tambahkan metadata template dan unggah versi DOCX/RTF untuk mulai memetakan placeholder." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="border-b border-border text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3 font-medium">Template</th>
                    <th className="px-3 py-3 font-medium">Kategori</th>
                    <th className="px-3 py-3 font-medium">File</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3 font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-border/70">
                      <td className="px-3 py-4">
                        <p className="font-medium text-foreground">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.slug}</p>
                      </td>
                      <td className="px-3 py-4 text-muted-foreground">{item.categoryName || "-"}</td>
                      <td className="px-3 py-4">
                        <Badge variant="outline">{item.fileType || "metadata"}</Badge>
                        <p className="mt-1 max-w-[240px] truncate text-xs text-muted-foreground">{item.originalFilename || "Belum ada file"}</p>
                      </td>
                      <td className="px-3 py-4">
                        <TemplateStatusBadge status={item.status} />
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Badge variant={item.supportsAi ? "success" : "outline"}>{item.supportsAi ? "AI ON" : "AI OFF"}</Badge>
                          <Badge variant={item.requiresValidation ? "warning" : "outline"}>{item.requiresValidation ? "Validasi" : "Tanpa validasi"}</Badge>
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/templates/${encodeURIComponent(item.id)}`}>Detail</Link>
                          </Button>
                          {can(access, JLF_PERMISSION.TEMPLATE_UPDATE) ? (
                            <Button asChild size="sm" variant="outline">
                              <Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/templates/${encodeURIComponent(item.id)}/edit`}>Edit</Link>
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TemplateForm({
  mode,
  templateId,
}: {
  mode: "new" | "edit";
  templateId?: string;
}) {
  const { currentUser, access } = useJlfAccess();
  const canCreate = can(access, JLF_PERMISSION.TEMPLATE_CREATE);
  const canUpdate = can(access, JLF_PERMISSION.TEMPLATE_UPDATE);
  const canUpload = can(access, JLF_PERMISSION.TEMPLATE_VERSION_MANAGE);
  const allowed = mode === "new" ? canCreate : canUpdate;
  const categoriesState = useCategories(allowed);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    categoryId: "",
    name: "",
    slug: "",
    description: "",
    documentType: "legal_form",
    fileType: "docx",
    status: "draft",
    requiresValidation: "true",
    supportsAi: "false",
    supportsWhatsappNotification: "false",
  });

  useEffect(() => {
    if (mode !== "edit" || !templateId || !allowed) return;
    const timer = window.setTimeout(() => {
      void fetch(apiPath(`/api/judicia/legal-form/templates/${encodeURIComponent(templateId)}`), {
          cache: "no-store",
          credentials: "include",
        })
        .then((response) => readApi<TemplateItem>(response))
        .then((template) =>
          setForm({
            categoryId: template.categoryId,
            name: template.name,
            slug: template.slug,
            description: template.description,
            documentType: template.documentType,
            fileType: template.fileType || "docx",
            status: template.status,
            requiresValidation: String(template.requiresValidation),
            supportsAi: String(template.supportsAi),
            supportsWhatsappNotification: String(template.supportsWhatsappNotification),
          })
        )
        .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Gagal memuat template."));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [allowed, mode, templateId]);

  useEffect(() => {
    if (form.categoryId || categoriesState.categories.length === 0) return;
    const timer = window.setTimeout(() => {
      setForm((current) => ({ ...current, categoryId: current.categoryId || categoriesState.categories[0]?.id || "" }));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [categoriesState.categories, form.categoryId]);

  async function submit() {
    setBusy(true);
    setMessage("");
    try {
      const payload = {
        ...form,
        requiresValidation: form.requiresValidation === "true",
        supportsAi: form.supportsAi === "true",
        supportsWhatsappNotification: form.supportsWhatsappNotification === "true",
      };
      const template = mode === "new"
        ? await readApi<TemplateItem>(
            await fetch(apiPath("/api/judicia/legal-form/templates"), {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
          )
        : await readApi<TemplateItem>(
            await fetch(apiPath(`/api/judicia/legal-form/templates/${encodeURIComponent(templateId ?? "")}`), {
              method: "PATCH",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
          );

      if (file && canUpload) {
        const formData = new FormData();
        formData.set("file", file);
        formData.set("changeNote", mode === "new" ? "Versi awal template." : "Upload versi baru dari halaman edit.");
        await readApi(
          await fetch(apiPath(`/api/judicia/legal-form/templates/${encodeURIComponent(template.id)}/upload-version`), {
            method: "POST",
            credentials: "include",
            body: formData,
          })
        );
      }

      setMessage("Template JLF berhasil disimpan.");
      if (mode === "new") {
        window.location.assign(apiPath(`${JUDICIA_LEGAL_FORM_ROUTE}/templates/${encodeURIComponent(template.id)}`));
      } else {
        window.location.assign(apiPath(`${JUDICIA_LEGAL_FORM_ROUTE}/templates`));
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menyimpan template JLF.");
    } finally {
      setBusy(false);
    }
  }

  if (!currentUser) return <JlfLoadingState />;
  if (!allowed) return <AccessDeniedCard />;

  return (
    <div className="space-y-8">
      <PageIntro
        eyebrow="Template Dokumen"
        title={mode === "new" ? "Tambah Template" : "Edit Template"}
        description="Metadata disimpan dulu, lalu file DOCX/RTF diunggah sebagai versi template pada storage private JLF."
        actions={
          <Button asChild variant="outline">
            <Link href={mode === "edit" && templateId ? `${JUDICIA_LEGAL_FORM_ROUTE}/templates/${encodeURIComponent(templateId)}` : `${JUDICIA_LEGAL_FORM_ROUTE}/templates`}>
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </Link>
          </Button>
        }
      />

      {message || categoriesState.message ? (
        <Card className="border-border/80">
          <CardContent className="p-4 text-sm text-muted-foreground">{message || categoriesState.message}</CardContent>
        </Card>
      ) : null}

      <Card className="border-border/80">
        <CardHeader>
          <CardTitle>Metadata Template</CardTitle>
          <CardDescription>DOCX menjadi target modern; RTF tetap didukung untuk kompatibilitas legacy.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Kategori Blangko</span>
            <NativeSelect value={form.categoryId} onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}>
              <option value="">Pilih kategori</option>
              {categoriesState.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Nama Template</span>
            <Input
              value={form.name}
              onChange={(event) => {
                const nextName = event.target.value;
                setForm((current) => ({
                  ...current,
                  name: nextName,
                  documentType: inferDocumentTypeFromName(nextName, current.documentType),
                }));
              }}
              placeholder="[01] [Kabul Verstek] Cerai (Format Lengkap)"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Slug</span>
            <Input value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} placeholder="Opsional, boleh dikosongkan" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Tipe Dokumen</span>
            <NativeSelect value={form.documentType} onChange={(event) => setForm((current) => ({ ...current, documentType: event.target.value }))}>
              {DOCUMENT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </NativeSelect>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Format File Template</span>
            <NativeSelect value={form.fileType} onChange={(event) => setForm((current) => ({ ...current, fileType: event.target.value }))}>
              <option value="docx">DOCX</option>
              <option value="rtf">RTF</option>
            </NativeSelect>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Status Template</span>
            <NativeSelect value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </NativeSelect>
          </label>
          <Textarea
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            placeholder="Deskripsi template"
            className="md:col-span-2"
          />
          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Validasi Dokumen</span>
            <NativeSelect value={form.requiresValidation} onChange={(event) => setForm((current) => ({ ...current, requiresValidation: event.target.value }))}>
              <option value="true">Perlu validasi</option>
              <option value="false">Tidak perlu validasi</option>
            </NativeSelect>
          </label>
          <div className="rounded-2xl border border-border/80 bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Bantuan AI Template</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Default mati. Aktifkan hanya untuk saran field, ringkasan, atau draft yang tetap direview manusia.</p>
              </div>
              <Switch
                checked={form.supportsAi === "true"}
                onCheckedChange={(checked) => setForm((current) => ({ ...current, supportsAi: String(checked) }))}
              />
            </div>
          </div>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Notifikasi WhatsApp</span>
            <NativeSelect value={form.supportsWhatsappNotification} onChange={(event) => setForm((current) => ({ ...current, supportsWhatsappNotification: event.target.value }))}>
              <option value="false">Tanpa notifikasi WhatsApp</option>
              <option value="true">Dukung notifikasi WhatsApp</option>
            </NativeSelect>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">File Template</span>
            <Input type="file" accept=".docx,.rtf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </label>
          <Button type="button" disabled={busy || !form.categoryId || !form.name.trim()} onClick={submit} className="md:col-span-2">
            <Save className="h-4 w-4" />
            Simpan Template
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function JlfTemplateNewPage() {
  return <TemplateForm mode="new" />;
}

export function JlfTemplateEditPage({ templateId }: { templateId: string }) {
  return <TemplateForm mode="edit" templateId={templateId} />;
}

export function JlfTemplateDetailPage({ templateId }: { templateId: string }) {
  const { currentUser, access } = useJlfAccess();
  const canView = can(access, JLF_PERMISSION.TEMPLATE_VIEW);
  const canUpdate = can(access, JLF_PERMISSION.TEMPLATE_UPDATE);
  const canAi = can(access, JLF_PERMISSION.AI_USE);
  const [template, setTemplate] = useState<TemplateItem | null>(null);
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [variables, setVariables] = useState<VariableItem[]>([]);
  const [mappings, setMappings] = useState<TemplateVariable[]>([]);
  const [report, setReport] = useState<PlaceholderReport | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [mapForm, setMapForm] = useState({ placeholder: "", variableId: "", isRequired: "false" });

  async function loadDetail() {
    if (!canView) return;
    setLoading(true);
    try {
      const [templateData, versionsData, variablesData, mappingData] = await Promise.all([
        readApi<TemplateItem>(await fetch(apiPath(`/api/judicia/legal-form/templates/${encodeURIComponent(templateId)}`), { cache: "no-store", credentials: "include" })),
        readApi<{ items: TemplateVersion[] }>(await fetch(apiPath(`/api/judicia/legal-form/templates/${encodeURIComponent(templateId)}/versions`), { cache: "no-store", credentials: "include" })),
        readApi<{ items: VariableItem[] }>(await fetch(apiPath("/api/judicia/legal-form/variables?limit=300"), { cache: "no-store", credentials: "include" })),
        readApi<{ items: TemplateVariable[] }>(await fetch(apiPath(`/api/judicia/legal-form/templates/${encodeURIComponent(templateId)}/variables`), { cache: "no-store", credentials: "include" })),
      ]);
      setTemplate(templateData);
      setVersions(versionsData.items ?? []);
      setVariables(variablesData.items ?? []);
      setMappings(mappingData.items ?? []);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat detail template.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canView) return;
    const timer = window.setTimeout(() => {
      setLoading(true);
      void Promise.all([
        fetch(apiPath(`/api/judicia/legal-form/templates/${encodeURIComponent(templateId)}`), { cache: "no-store", credentials: "include" }).then((response) => readApi<TemplateItem>(response)),
        fetch(apiPath(`/api/judicia/legal-form/templates/${encodeURIComponent(templateId)}/versions`), { cache: "no-store", credentials: "include" }).then((response) => readApi<{ items: TemplateVersion[] }>(response)),
        fetch(apiPath("/api/judicia/legal-form/variables?limit=300"), { cache: "no-store", credentials: "include" }).then((response) => readApi<{ items: VariableItem[] }>(response)),
        fetch(apiPath(`/api/judicia/legal-form/templates/${encodeURIComponent(templateId)}/variables`), { cache: "no-store", credentials: "include" }).then((response) => readApi<{ items: TemplateVariable[] }>(response)),
      ])
        .then(([templateData, versionsData, variablesData, mappingData]) => {
          setTemplate(templateData);
          setVersions(versionsData.items ?? []);
          setVariables(variablesData.items ?? []);
          setMappings(mappingData.items ?? []);
          setMessage("");
        })
        .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Gagal memuat detail template."))
        .finally(() => setLoading(false));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [canView, templateId]);

  async function detectPlaceholders() {
    try {
      const data = await readApi<PlaceholderReport>(
        await fetch(apiPath(`/api/judicia/legal-form/templates/${encodeURIComponent(templateId)}/detect-placeholders`), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
      );
      setReport(data);
      setMessage("Deteksi placeholder selesai.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Deteksi placeholder gagal.");
    }
  }

  async function mapVariable() {
    try {
      const data = await readApi<{ items: TemplateVariable[] }>(
        await fetch(apiPath(`/api/judicia/legal-form/templates/${encodeURIComponent(templateId)}/variables`), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            placeholder: mapForm.placeholder,
            variableId: mapForm.variableId,
            isRequired: mapForm.isRequired === "true",
          }),
        })
      );
      setMappings(data.items ?? []);
      setMessage("Mapping variabel disimpan.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Mapping variabel gagal.");
    }
  }

  const mappedPlaceholders = useMemo(() => new Set(mappings.map((item) => item.placeholder)), [mappings]);
  const unmappedDetected = useMemo(
    () => (report?.placeholders ?? []).filter((item) => !mappedPlaceholders.has(item.placeholder)),
    [mappedPlaceholders, report]
  );

  if (!currentUser) return <JlfLoadingState />;
  if (!canView) return <AccessDeniedCard />;

  return (
    <div className="space-y-8">
      <PageIntro
        eyebrow="Template Dokumen"
        title={template?.name ?? "Detail Template"}
        description="Detail template, versi file, placeholder terdeteksi, dan mapping variabel."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/templates`}>
                <ArrowLeft className="h-4 w-4" />
                Template
              </Link>
            </Button>
            {canUpdate ? (
              <Button asChild variant="outline">
                <Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/templates/${encodeURIComponent(templateId)}/edit`}>
                  Edit
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      {message ? (
        <Card className="border-border/80">
          <CardContent className="p-4 text-sm text-muted-foreground">{message}</CardContent>
        </Card>
      ) : null}

      {loading ? (
        <JlfLoadingState />
      ) : template ? (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="border-border/80">
              <CardHeader>
                <CardDescription>Status</CardDescription>
                <CardTitle><TemplateStatusBadge status={template.status} /></CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/80">
              <CardHeader>
                <CardDescription>Kategori</CardDescription>
                <CardTitle className="text-lg">{template.categoryName || "-"}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/80">
              <CardHeader>
                <CardDescription>AI Template</CardDescription>
                <CardTitle className="text-lg">
                  <Badge variant={template.supportsAi ? "success" : "outline"}>{template.supportsAi ? "Aktif" : "Nonaktif"}</Badge>
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card className="border-border/80">
            <CardHeader>
              <CardDescription>File Aktif</CardDescription>
              <CardTitle className="text-lg">{template.originalFilename || "Belum ada file"}</CardTitle>
            </CardHeader>
          </Card>

          <Card className="border-border/80">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>Placeholder</CardTitle>
                  <CardDescription>Legacy `#0001#` dan modern `{"{{nomor_perkara}}"}` didukung. Unknown placeholder tidak membuat sistem crash.</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={detectPlaceholders}>
                    <RefreshCw className="h-4 w-4" />
                    Deteksi
                  </Button>
                  <Button type="button" variant="outline" disabled={!canAi}>
                    <Bot className="h-4 w-4" />
                    AI Suggestion
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {report?.parserWarnings?.map((warning) => (
                <div key={warning} className="rounded-xl border border-amber-300/70 bg-amber-100 px-4 py-3 text-sm text-amber-800 dark:border-amber-700/50 dark:bg-amber-950/70 dark:text-amber-300">
                  {warning}
                </div>
              ))}
              {!report ? (
                <EmptyState title="Placeholder belum dideteksi" description="Jalankan deteksi untuk membaca placeholder dari versi template terbaru." />
              ) : report.placeholders.length === 0 ? (
                <EmptyState title="Tidak ada placeholder" description="Parser belum menemukan placeholder legacy atau modern pada versi template ini." />
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {report.placeholders.map((placeholder) => (
                    <div key={`${placeholder.kind}-${placeholder.placeholder}`} className="rounded-xl border border-border/80 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-mono text-sm font-semibold text-foreground">{placeholder.placeholder}</p>
                        <Badge variant={mappedPlaceholders.has(placeholder.placeholder) ? "success" : "warning"}>
                          {mappedPlaceholders.has(placeholder.placeholder) ? "mapped" : "unmapped"}
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">{placeholder.kind} - muncul {placeholder.count}x</p>
                    </div>
                  ))}
                </div>
              )}
              {unmappedDetected.length > 0 ? (
                <div className="rounded-xl border border-amber-300/70 bg-amber-100 px-4 py-3 text-sm text-amber-800 dark:border-amber-700/50 dark:bg-amber-950/70 dark:text-amber-300">
                  {unmappedDetected.length} placeholder belum punya mapping variabel.
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-border/80">
            <CardHeader>
              <CardTitle>Mapping Variabel</CardTitle>
              <CardDescription>Hubungkan placeholder template ke registry variabel JLF.</CardDescription>
            </CardHeader>
            {canUpdate ? (
              <CardContent className="grid gap-3 md:grid-cols-[1fr_1fr_160px_auto]">
                <Input value={mapForm.placeholder} onChange={(event) => setMapForm((current) => ({ ...current, placeholder: event.target.value }))} placeholder="#0001# atau {{nomor_perkara}}" />
                <NativeSelect value={mapForm.variableId} onChange={(event) => setMapForm((current) => ({ ...current, variableId: event.target.value }))}>
                  <option value="">Pilih variabel</option>
                  {variables.map((variable) => (
                    <option key={variable.id} value={variable.id}>
                      {variable.key} - {variable.label}
                    </option>
                  ))}
                </NativeSelect>
                <NativeSelect value={mapForm.isRequired} onChange={(event) => setMapForm((current) => ({ ...current, isRequired: event.target.value }))}>
                  <option value="false">Opsional</option>
                  <option value="true">Wajib</option>
                </NativeSelect>
                <Button type="button" disabled={!mapForm.placeholder || !mapForm.variableId} onClick={mapVariable}>
                  <Plus className="h-4 w-4" />
                  Map
                </Button>
              </CardContent>
            ) : null}
            <CardContent>
              {mappings.length === 0 ? (
                <EmptyState title="Belum ada mapping" description="Placeholder yang belum dipetakan akan tampil sebagai warning saat validasi template." />
              ) : (
                <div className="grid gap-3">
                  {mappings.map((mapping) => (
                    <div key={mapping.id} className="flex flex-col gap-2 rounded-xl border border-border/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-mono text-sm font-semibold text-foreground">{mapping.placeholder}</p>
                        <p className="text-sm text-muted-foreground">{mapping.variableKey} - {mapping.variableLabel}</p>
                      </div>
                      <Badge variant={mapping.isRequired ? "warning" : "outline"}>{mapping.isRequired ? "Wajib" : "Opsional"}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/80">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>Dasar Hukum & Peraturan</CardTitle>
                  <CardDescription>Hubungkan template dengan peraturan/pasal JLF yang sudah masuk Legal Knowledge Base.</CardDescription>
                </div>
                <Button asChild variant="outline">
                  <Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/regulations`}>
                    <Scale className="h-4 w-4" />
                    Buka Legal KB
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="text-sm leading-6 text-muted-foreground">
              API relasi template-peraturan tersedia di route template ini. Relasi tetap membutuhkan review admin dan tidak otomatis dibuat oleh AI.
            </CardContent>
          </Card>

          <Card className="border-border/80">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>Versi Template</CardTitle>
                  <CardDescription>Versi file disimpan private dengan checksum SHA-256.</CardDescription>
                </div>
                <Button asChild variant="outline">
                  <Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/templates/${encodeURIComponent(templateId)}/versions`}>
                    <FileText className="h-4 w-4" />
                    Lihat Versi
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3">
              {versions.slice(0, 3).map((version) => (
                <div key={version.id} className="rounded-xl border border-border/80 p-4">
                  <p className="font-semibold text-foreground">Versi {version.versionNumber}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{version.checksum}</p>
                </div>
              ))}
              {versions.length === 0 ? <EmptyState title="Belum ada versi" description="Unggah file DOCX/RTF dari halaman edit template." /> : null}
            </CardContent>
          </Card>
        </>
      ) : (
        <AccessDeniedCard />
      )}
    </div>
  );
}

export function JlfTemplateVersionsPage({ templateId }: { templateId: string }) {
  const { currentUser, access } = useJlfAccess();
  const canView = can(access, JLF_PERMISSION.TEMPLATE_VIEW);
  const [items, setItems] = useState<TemplateVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!canView) return;
    const timer = window.setTimeout(() => {
      void fetch(apiPath(`/api/judicia/legal-form/templates/${encodeURIComponent(templateId)}/versions`), {
          cache: "no-store",
          credentials: "include",
        })
        .then((response) => readApi<{ items: TemplateVersion[] }>(response))
        .then((data) => {
          setItems(data.items ?? []);
          setMessage("");
        })
        .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Gagal memuat versi template."))
        .finally(() => setLoading(false));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [canView, templateId]);

  if (!currentUser) return <JlfLoadingState />;
  if (!canView) return <AccessDeniedCard />;

  return (
    <div className="space-y-8">
      <PageIntro
        eyebrow="Template Dokumen"
        title="Versi Template"
        description="Riwayat versi template, checksum, dan placeholder yang pernah terdeteksi."
        actions={
          <Button asChild variant="outline">
            <Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/templates/${encodeURIComponent(templateId)}`}>
              <ArrowLeft className="h-4 w-4" />
              Detail
            </Link>
          </Button>
        }
      />
      {message ? <Card className="border-border/80"><CardContent className="p-4 text-sm text-muted-foreground">{message}</CardContent></Card> : null}
      <Card className="border-border/80">
        <CardContent className="p-6">
          {loading ? (
            <JlfLoadingState />
          ) : items.length === 0 ? (
            <EmptyState title="Belum ada versi" description="Unggah file template untuk membuat versi awal." />
          ) : (
            <div className="grid gap-3">
              {items.map((item) => (
                <div key={item.id} className="rounded-xl border border-border/80 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-foreground">Versi {item.versionNumber}</p>
                      <p className="text-sm text-muted-foreground">{item.changeNote || "Tanpa catatan perubahan"}</p>
                    </div>
                    <Badge variant="outline">{item.detectedPlaceholders?.length ?? 0} placeholder</Badge>
                  </div>
                  <p className="mt-3 break-all font-mono text-xs text-muted-foreground">{item.checksum}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
