"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, FileText, Pencil, Plus, Power, Save, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { apiPath } from "@/lib/base-path";
import { canCreateOutgoingLetter } from "@/lib/permissions";
import { type LetterTemplate, type LetterTemplateCategory } from "@/lib/types";

const templateCategories: Array<{ value: LetterTemplateCategory; label: string }> = [
  { value: "undangan", label: "Undangan" },
  { value: "permintaan_data", label: "Permintaan Data" },
  { value: "balasan_surat", label: "Balasan Surat" },
  { value: "surat_tugas", label: "Surat Tugas" },
  { value: "lainnya", label: "Lainnya" },
];

const allowedPlaceholders = [
  "nomor_surat",
  "tanggal_surat",
  "tujuan",
  "perihal",
  "nama_pengadilan",
  "alamat_pengadilan",
  "nama_penandatangan",
  "jabatan_penandatangan",
] as const;

const sampleData: Record<string, string> = {
  nomor_surat: "W19-A6/001/HK.05/I/2026",
  tanggal_surat: "12 Januari 2026",
  tujuan: "Pengadilan Tinggi Agama",
  perihal: "Permintaan Data",
  nama_pengadilan: "Pengadilan Agama Donggala",
  alamat_pengadilan: "Jl. Vatu Bala, Donggala",
  nama_penandatangan: "ABDUL SALAM, S.HI. MH.",
  jabatan_penandatangan: "Ketua",
};

type TemplateForm = {
  id?: string;
  name: string;
  category: LetterTemplateCategory;
  description: string;
  body: string;
  isActive: boolean;
};

function makeEmptyForm(): TemplateForm {
  return {
    name: "",
    category: "permintaan_data",
    description: "",
    body:
      "Kepada Yth. {{tujuan}}\n\nDengan hormat,\nSehubungan dengan {{perihal}}, bersama ini kami sampaikan surat nomor {{nomor_surat}} tanggal {{tanggal_surat}}.\n\nHormat kami,\n{{nama_penandatangan}}\n{{jabatan_penandatangan}}",
    isActive: true,
  };
}

function templateToForm(template: LetterTemplate): TemplateForm {
  return {
    id: template.id,
    name: template.name,
    category: template.category,
    description: template.description,
    body: template.body,
    isActive: template.isActive,
  };
}

function extractPlaceholders(body: string) {
  return Array.from(new Set(Array.from(body.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)).map((match) => match[1])));
}

function renderPreview(body: string) {
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => sampleData[key] ?? `{{${key}}}`);
}

async function readApi<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as { ok?: boolean; data?: T; error?: { message?: string } } | null;
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error?.message || "Format surat keluar gagal dimuat.");
  }
  return payload.data as T;
}

export function LetterTemplateManager({ currentUser }: { currentUser: Parameters<typeof canCreateOutgoingLetter>[0] }) {
  const canManage = canCreateOutgoingLetter(currentUser);
  const [templates, setTemplates] = useState<LetterTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState<TemplateForm | null>(null);
  const placeholders = useMemo(() => extractPlaceholders(form?.body ?? ""), [form?.body]);
  const unknownPlaceholders = useMemo(
    () => placeholders.filter((placeholder) => !allowedPlaceholders.includes(placeholder as (typeof allowedPlaceholders)[number])),
    [placeholders]
  );

  const loadTemplates = useCallback(async () => {
    if (!canManage) return;
    setIsLoading(true);
    try {
      const response = await fetch(apiPath("/api/surat/templates"), {
        credentials: "include",
        cache: "no-store",
      });
      const data = await readApi<{ items: LetterTemplate[] }>(response);
      setTemplates(data.items);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Format surat keluar gagal dimuat.");
    } finally {
      setIsLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTemplates();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadTemplates]);

  if (!canManage) return null;

  const saveTemplate = async () => {
    if (!form) return;
    if (!form.name.trim()) {
      setNotice("Nama format wajib diisi.");
      return;
    }
    if (form.isActive && unknownPlaceholders.length > 0) {
      setNotice(`Format aktif tidak boleh memakai kolom otomatis yang tidak dikenal: ${unknownPlaceholders.join(", ")}.`);
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(apiPath(form.id ? `/api/surat/templates/${encodeURIComponent(form.id)}` : "/api/surat/templates"), {
        method: form.id ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      await readApi<LetterTemplate>(response);
      await loadTemplates();
      setForm(null);
      setNotice("Format surat keluar berhasil disimpan.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Format surat keluar gagal disimpan.");
    } finally {
      setIsSaving(false);
    }
  };

  const deactivateTemplate = async (template: LetterTemplate) => {
    setIsSaving(true);
    try {
      const response = await fetch(apiPath(`/api/surat/templates/${encodeURIComponent(template.id)}`), {
        method: "DELETE",
        credentials: "include",
      });
      await readApi<{ id: string; isActive: boolean }>(response);
      await loadTemplates();
      setNotice(`Format ${template.name} dinonaktifkan.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Format gagal dinonaktifkan.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="border-border/90">
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Format Surat Keluar
          </CardTitle>
          <CardDescription>
            Kelola contoh format surat keluar. Kolom otomatis dicek agar contoh surat tidak salah.
          </CardDescription>
        </div>
        <Button type="button" onClick={() => setForm(makeEmptyForm())} disabled={isSaving}>
          <Plus className="h-4 w-4" />
          Tambah Format
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {notice ? (
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
            {notice}
          </div>
        ) : null}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Memuat format surat keluar...</p>
        ) : templates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            Belum ada format surat keluar. Tambahkan format pertama untuk membantu membuat surat.
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {templates.map((template) => (
              <div key={template.id} className="min-w-0 rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{template.name}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{template.description || "Tanpa deskripsi"}</p>
                  </div>
                  <Badge variant={template.isActive ? "success" : "muted"}>{template.isActive ? "Aktif" : "Nonaktif"}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{templateCategories.find((item) => item.value === template.category)?.label ?? template.category}</Badge>
                  <Badge variant="outline">{template.placeholders.length} kolom otomatis</Badge>
                </div>
                <pre className="mt-3 max-h-36 overflow-hidden rounded-xl border border-border bg-muted/30 p-3 text-xs leading-5 whitespace-pre-wrap">
                  {template.body}
                </pre>
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setForm(templateToForm(template))} disabled={isSaving}>
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                  {template.isActive ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => void deactivateTemplate(template)} disabled={isSaving}>
                      <Power className="h-4 w-4" />
                      Nonaktifkan
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {form ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-auto rounded-[1.4rem] border border-border bg-card p-5 shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Format Surat Keluar</p>
                <h2 className="mt-2 text-xl font-semibold text-foreground">{form.id ? "Edit Format" : "Tambah Format"}</h2>
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={() => setForm(null)} disabled={isSaving}>
                <X className="h-4 w-4" />
                Tutup
              </Button>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="space-y-4">
                <Input value={form.name} onChange={(event) => setForm((current) => current ? { ...current, name: event.target.value } : current)} placeholder="Nama format" />
                <NativeSelect value={form.category} onChange={(event) => setForm((current) => current ? { ...current, category: event.target.value as LetterTemplateCategory } : current)}>
                  {templateCategories.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </NativeSelect>
                <Input value={form.description} onChange={(event) => setForm((current) => current ? { ...current, description: event.target.value } : current)} placeholder="Deskripsi singkat" />
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(event) => setForm((current) => current ? { ...current, isActive: event.target.checked } : current)}
                  />
                  Format aktif
                </label>
                <Textarea value={form.body} rows={14} onChange={(event) => setForm((current) => current ? { ...current, body: event.target.value } : current)} />
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Eye className="h-4 w-4" />
                    Contoh Isi
                  </p>
                  <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap text-sm leading-6 text-foreground">
                    {renderPreview(form.body)}
                  </pre>
                </div>
                <div className="rounded-xl border border-border p-4">
                  <p className="text-sm font-semibold text-foreground">Kolom otomatis terdeteksi</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {placeholders.length > 0 ? placeholders.map((placeholder) => (
                      <Badge key={placeholder} variant={unknownPlaceholders.includes(placeholder) ? "danger" : "success"}>
                        {placeholder}
                      </Badge>
                    )) : <span className="text-sm text-muted-foreground">Belum ada kolom otomatis.</span>}
                  </div>
                  {unknownPlaceholders.length > 0 ? (
                    <p className="mt-3 text-sm text-destructive">
                      Kolom otomatis tidak dikenal: {unknownPlaceholders.join(", ")}. Format harus dinonaktifkan atau diperbaiki sebelum aktif.
                    </p>
                  ) : null}
                  <p className="mt-4 text-xs leading-5 text-muted-foreground">
                    Kolom otomatis yang didukung: {allowedPlaceholders.join(", ")}.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setForm(null)} disabled={isSaving}>
                Batal
              </Button>
              <Button type="button" onClick={() => void saveTemplate()} disabled={isSaving}>
                <Save className="h-4 w-4" />
                Simpan Format
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
