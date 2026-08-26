"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowDown, ArrowUp, Plus, RefreshCw, Save, Trash2 } from "lucide-react";

import { JlfLoadingState } from "@/components/portal/judicia/legal-form/jlf-foundation";
import { AccessDeniedCard, EmptyState, PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
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

type BasQaItem = {
  id: string;
  order: number;
  subjectType?: "umum" | "saksi" | "pihak" | "ahli";
  answerMode?: "manual" | "default" | "sipp";
  sourceKey?: string;
  question: string;
  answer: string;
};

type BasQaTemplate = {
  id: string;
  code: string;
  name: string;
  caseType: string;
  paperSize: string;
  isActive: boolean;
  items: BasQaItem[];
  updatedAt: string;
};

async function readApi<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error?.message ?? "Permintaan Tanya Jawab/BAS belum berhasil.");
  }
  return payload?.data as T;
}

function getTemplateRank(template: BasQaTemplate) {
  const haystack = `${template.caseType} ${template.name} ${template.code}`.toLowerCase();
  if (/(verstek|ghaib|relas|panggilan|pemberitahuan)/.test(haystack)) return 0;
  if (/umum/.test(haystack)) return 1;
  if (/cerai gugat/.test(haystack)) return 2;
  if (/cerai talak|ikrar talak/.test(haystack)) return 3;
  if (/nafkah/.test(haystack)) return 4;
  if (/hadhanah|hak asuh|pengasuhan/.test(haystack)) return 5;
  if (/harta bersama/.test(haystack)) return 6;
  if (/itsbat|pengesahan perkawinan/.test(haystack)) return 7;
  if (/dispensasi/.test(haystack)) return 8;
  if (/wali adhal/.test(haystack)) return 9;
  if (/asal usul anak/.test(haystack)) return 10;
  if (/pembatalan/.test(haystack)) return 11;
  if (/poligami/.test(haystack)) return 12;
  if (/waris/.test(haystack)) return 13;
  if (/hibah|wasiat|wakaf|zakat|infak|sedekah/.test(haystack)) return 14;
  if (/ekonomi syariah/.test(haystack)) return 15;
  if (/perwalian|pengampuan/.test(haystack)) return 16;
  if (/mafqud|orang hilang/.test(haystack)) return 17;
  if (/persidangan|administrasi|mediasi/.test(haystack)) return 18;
  if (/validasi bas|berita acara/.test(haystack)) return 19;
  if (/putusan|penetapan/.test(haystack)) return 20;
  if (/eksekusi/.test(haystack)) return 21;
  if (/jinayat/.test(haystack)) return 22;
  return 99;
}

function getTemplateScenario(template: BasQaTemplate) {
  const haystack = `${template.caseType} ${template.name} ${template.code}`.toLowerCase();
  if (/verstek|ghaib/.test(haystack)) return "Verstek";
  if (/mediasi/.test(haystack)) return "Mediasi";
  if (/pembuktian|saksi|bukti/.test(haystack)) return "Pembuktian";
  if (/panggilan|relas|pemberitahuan/.test(haystack)) return "Panggilan/Relaas";
  if (/ikrar/.test(haystack)) return "Ikrar";
  if (/validasi bas|berita acara/.test(haystack)) return "BAS";
  return "Umum";
}

function sortTemplates(left: BasQaTemplate, right: BasQaTemplate) {
  return (
    getTemplateRank(left) - getTemplateRank(right) ||
    left.caseType.localeCompare(right.caseType) ||
    left.code.localeCompare(right.code) ||
    left.name.localeCompare(right.name)
  );
}

function groupTemplatesByCaseType(templates: BasQaTemplate[]) {
  const groups = new Map<string, BasQaTemplate[]>();
  for (const template of [...templates].sort(sortTemplates)) {
    const key = template.caseType.trim() || "Umum";
    groups.set(key, [...(groups.get(key) ?? []), template]);
  }
  return [...groups.entries()]
    .map(([caseType, items]) => ({ caseType, items }))
    .sort((left, right) => getTemplateRank(left.items[0]) - getTemplateRank(right.items[0]) || left.caseType.localeCompare(right.caseType));
}

function subjectLabel(value?: BasQaItem["subjectType"]) {
  if (value === "saksi") return "Saksi";
  if (value === "pihak") return "Pihak";
  if (value === "ahli") return "Ahli";
  return "Umum";
}

function answerModeLabel(value?: BasQaItem["answerMode"]) {
  if (value === "sipp") return "SIPP/source";
  if (value === "default") return "Default";
  return "Manual";
}

function renderBasPreview(template: BasQaTemplate | null) {
  if (!template) return "";
  return template.items
    .slice()
    .sort((left, right) => left.order - right.order)
    .map((item) => {
      const subject = item.subjectType && item.subjectType !== "umum" ? `${subjectLabel(item.subjectType)}: ` : "";
      const answer = item.answer || (item.answerMode === "sipp" && item.sourceKey ? `{{${item.sourceKey}}}` : "");
      return answer ? `${item.order}. ${subject}${item.question}\n   Jawaban: ${answer}` : `${item.order}. ${subject}${item.question}`;
    })
    .join("\n");
}

function useJlfAccess() {
  const { currentUser, positions } = usePortal();
  const access = resolveJudiciaLegalFormAccess(currentUser, {
    effectiveRoleId: getEffectiveRoleId(currentUser),
    positionLabel: getUserPositionLabel(currentUser, positions),
  });
  return { currentUser, access };
}

export function JlfBasQaPage() {
  const { currentUser, access } = useJlfAccess();
  const canView = hasJudiciaLegalFormPermission(access, JLF_PERMISSION.TEMPLATE_VIEW);
  const canManage = hasJudiciaLegalFormPermission(access, JLF_PERMISSION.TEMPLATE_UPDATE);
  const canDelete = hasJudiciaLegalFormPermission(access, JLF_PERMISSION.TEMPLATE_DELETE);
  const [templates, setTemplates] = useState<BasQaTemplate[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [templateDraft, setTemplateDraft] = useState({ code: "", name: "", caseType: "", paperSize: "A4" });
  const [itemDraft, setItemDraft] = useState({ subjectType: "saksi", answerMode: "manual", sourceKey: "", question: "", answer: "" });
  const [editingItemId, setEditingItemId] = useState("");
  const [editingItemDraft, setEditingItemDraft] = useState({ subjectType: "saksi", answerMode: "manual", sourceKey: "", question: "", answer: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedId) ?? templates[0] ?? null,
    [selectedId, templates]
  );
  const groupedTemplates = useMemo(() => groupTemplatesByCaseType(templates), [templates]);

  async function loadTemplates() {
    setBusy(true);
    setMessage("");
    try {
      const data = await readApi<{ items: BasQaTemplate[] }>(
        await fetch(apiPath("/api/judicia/legal-form/bas-qa"), {
          cache: "no-store",
          credentials: "include",
        })
      );
      const sortedTemplates = [...(data.items ?? [])].sort(sortTemplates);
      setTemplates(sortedTemplates);
      setSelectedId((current) => current || sortedTemplates[0]?.id || "");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Template Tanya Jawab/BAS belum dapat dimuat.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!canView) return;
    const timer = window.setTimeout(() => void loadTemplates(), 0);
    return () => window.clearTimeout(timer);
  }, [canView]);

  async function createTemplate() {
    setBusy(true);
    setMessage("");
    try {
      const template = await readApi<BasQaTemplate>(
        await fetch(apiPath("/api/judicia/legal-form/bas-qa"), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(templateDraft),
        })
      );
      setTemplates((current) => [...current, template].sort(sortTemplates));
      setSelectedId(template.id);
      setTemplateDraft({ code: "", name: "", caseType: "", paperSize: "A4" });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Template belum dapat dibuat.");
    } finally {
      setBusy(false);
    }
  }

  async function addItem() {
    if (!selectedTemplate) return;
    setBusy(true);
    setMessage("");
    try {
      await readApi<BasQaItem>(
        await fetch(apiPath(`/api/judicia/legal-form/bas-qa/${encodeURIComponent(selectedTemplate.id)}/items`), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(itemDraft),
        })
      );
      setItemDraft({ subjectType: "saksi", answerMode: "manual", sourceKey: "", question: "", answer: "" });
      await loadTemplates();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Pertanyaan belum dapat ditambahkan.");
    } finally {
      setBusy(false);
    }
  }

  async function updateItem(item: BasQaItem) {
    if (!selectedTemplate) return;
    setBusy(true);
    setMessage("");
    try {
      await readApi<BasQaItem>(
        await fetch(apiPath(`/api/judicia/legal-form/bas-qa/${encodeURIComponent(selectedTemplate.id)}/items/${encodeURIComponent(item.id)}`), {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editingItemDraft),
        })
      );
      setEditingItemId("");
      await loadTemplates();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Item belum dapat disimpan.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteItem(item: BasQaItem) {
    if (!selectedTemplate) return;
    setBusy(true);
    setMessage("");
    try {
      await readApi(
        await fetch(apiPath(`/api/judicia/legal-form/bas-qa/${encodeURIComponent(selectedTemplate.id)}/items/${encodeURIComponent(item.id)}`), {
          method: "DELETE",
          credentials: "include",
        })
      );
      await loadTemplates();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Item belum dapat dihapus.");
    } finally {
      setBusy(false);
    }
  }

  async function moveItem(item: BasQaItem, direction: "up" | "down") {
    if (!selectedTemplate) return;
    setBusy(true);
    setMessage("");
    try {
      await readApi(
        await fetch(apiPath(`/api/judicia/legal-form/bas-qa/${encodeURIComponent(selectedTemplate.id)}/items/${encodeURIComponent(item.id)}/move`), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ direction }),
        })
      );
      await loadTemplates();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Urutan belum dapat digeser.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteTemplate(template: BasQaTemplate) {
    setBusy(true);
    setMessage("");
    try {
      await readApi(
        await fetch(apiPath(`/api/judicia/legal-form/bas-qa/${encodeURIComponent(template.id)}`), {
          method: "DELETE",
          credentials: "include",
        })
      );
      setSelectedId("");
      await loadTemplates();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Template belum dapat dihapus.");
    } finally {
      setBusy(false);
    }
  }

  if (!currentUser) return <JlfLoadingState />;
  if (!canView) return <AccessDeniedCard />;

  return (
    <div className="space-y-8">
      <PageIntro
        eyebrow="Tanya Jawab/BAS"
        title="Template Tanya Jawab/BAS"
        description="Pakai daftar pertanyaan saksi/pihak yang sudah disusun per jenis perkara. Skenario verstek diprioritaskan di bagian atas agar alur kerja cepat seperti ABT."
        actions={
          <Button asChild variant="outline">
            <Link href={JUDICIA_LEGAL_FORM_ROUTE}>
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
          </Button>
        }
      />

      {message ? <Card className="border-border/80"><CardContent className="p-4 text-sm text-muted-foreground">{message}</CardContent></Card> : null}

      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <Card className="border-border/80">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Daftar Template</CardTitle>
                <CardDescription>Kode dan jenis perkara untuk tanya jawab/BAS.</CardDescription>
              </div>
              <Button type="button" size="icon" variant="outline" onClick={loadTemplates} disabled={busy}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {templates.length === 0 ? (
              <EmptyState title="Belum ada template" description="Tambah template tanya jawab pertama." />
            ) : groupedTemplates.map((group) => (
              <section key={group.caseType} className="space-y-2">
                <div className="sticky top-0 z-10 flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-card/95 px-3 py-2 backdrop-blur">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{group.caseType}</p>
                  <Badge variant="outline">{group.items.length} template</Badge>
                </div>
                {group.items.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => setSelectedId(template.id)}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition ${selectedTemplate?.id === template.id ? "border-primary/50 bg-primary/10" : "border-border/80 bg-card hover:border-primary/30"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-foreground">{template.name}</p>
                      <div className="flex flex-wrap justify-end gap-1">
                        <Badge variant={getTemplateScenario(template) === "Verstek" ? "warning" : "outline"}>{getTemplateScenario(template)}</Badge>
                        <Badge variant="outline">{template.code}</Badge>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{template.items.length} item pertanyaan</p>
                  </button>
                ))}
              </section>
            ))}

            {canManage ? (
              <div className="space-y-2 rounded-xl border border-border/80 p-3">
                <Input value={templateDraft.code} onChange={(event) => setTemplateDraft((current) => ({ ...current, code: event.target.value }))} placeholder="Kode, contoh Kode 01" />
                <Input value={templateDraft.name} onChange={(event) => setTemplateDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Nama template" />
                <Input value={templateDraft.caseType} onChange={(event) => setTemplateDraft((current) => ({ ...current, caseType: event.target.value }))} placeholder="Jenis perkara" />
                <Button type="button" className="w-full" disabled={busy || !templateDraft.code || !templateDraft.name} onClick={createTemplate}>
                  <Plus className="h-4 w-4" />
                  Tambah Template
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>{selectedTemplate?.name ?? "Pilih template"}</CardTitle>
                <CardDescription>
                  {selectedTemplate ? `${selectedTemplate.code} - ${selectedTemplate.caseType} - ${selectedTemplate.paperSize}` : "Belum ada template dipilih."}
                </CardDescription>
              </div>
              {selectedTemplate ? (
                <div className="flex flex-wrap gap-2">
                  <Badge variant={getTemplateScenario(selectedTemplate) === "Verstek" ? "warning" : "outline"}>{getTemplateScenario(selectedTemplate)}</Badge>
                  <Badge variant="outline">Pola ABT</Badge>
                  <Badge variant={selectedTemplate.isActive ? "success" : "muted"}>{selectedTemplate.isActive ? "Aktif" : "Nonaktif"}</Badge>
                  <Badge variant="outline">
                    {selectedTemplate.items.filter((item) => item.question.trim()).length}/{selectedTemplate.items.length} item siap
                  </Badge>
                  <Badge variant="outline">source_type: jlf_bas_qa</Badge>
                  {canDelete ? (
                    <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => void deleteTemplate(selectedTemplate)}>
                      <Trash2 className="h-4 w-4" />
                      Hapus
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedTemplate ? (
              <EmptyState title="Template belum dipilih" description="Pilih template di sebelah kiri." />
            ) : (
              <>
                <div className="rounded-xl border border-border/80 bg-muted/30 p-3 text-sm text-muted-foreground">
                  {canManage ? (
                    <>
                      Untuk mengisi section BAS dari resolver, buat variabel dengan <span className="font-mono text-foreground">source_type</span>{" "}
                      <span className="font-mono text-foreground">jlf_bas_qa</span> dan <span className="font-mono text-foreground">source_key</span>{" "}
                      berisi ID, kode, atau nama template ini. Placeholder di pertanyaan seperti <span className="font-mono text-foreground">{"{{nomor_perkara}}"}</span> tetap dipertahankan jika nilainya belum tersedia.
                    </>
                  ) : (
                    "Pilih template sesuai jenis perkara, cek urutan pertanyaan, lalu gunakan sebagai bahan BAS. Perubahan template hanya dapat dilakukan oleh Admin."
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[960px] text-left text-sm">
                    <thead className="border-b border-border text-muted-foreground">
                      <tr>
                        <th className="px-3 py-3 font-medium">Urutan</th>
                        <th className="px-3 py-3 font-medium">Subjek/source</th>
                        <th className="px-3 py-3 font-medium">Pertanyaan</th>
                        <th className="px-3 py-3 font-medium">Jawaban</th>
                        <th className="px-3 py-3 font-medium">Status</th>
                        <th className="px-3 py-3 font-medium">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTemplate.items.map((item) => (
                        <tr key={item.id} className="border-b border-border/70 align-top">
                          <td className="px-3 py-3">{item.order}</td>
                          <td className="px-3 py-3">
                            {editingItemId === item.id ? (
                              <div className="grid gap-2">
                                <NativeSelect value={editingItemDraft.subjectType} onChange={(event) => setEditingItemDraft((current) => ({ ...current, subjectType: event.target.value }))}>
                                  <option value="saksi">Saksi</option>
                                  <option value="pihak">Pihak</option>
                                  <option value="ahli">Ahli</option>
                                  <option value="umum">Umum</option>
                                </NativeSelect>
                                <NativeSelect value={editingItemDraft.answerMode} onChange={(event) => setEditingItemDraft((current) => ({ ...current, answerMode: event.target.value }))}>
                                  <option value="manual">Manual</option>
                                  <option value="default">Default</option>
                                  <option value="sipp">SIPP/source</option>
                                </NativeSelect>
                                <Input value={editingItemDraft.sourceKey} onChange={(event) => setEditingItemDraft((current) => ({ ...current, sourceKey: event.target.value }))} placeholder="source key opsional" />
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <Badge variant="outline">{subjectLabel(item.subjectType)}</Badge>
                                <p className="text-xs text-muted-foreground">{answerModeLabel(item.answerMode)}</p>
                                {item.sourceKey ? <p className="break-all font-mono text-xs text-muted-foreground">{item.sourceKey}</p> : null}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            {editingItemId === item.id ? (
                              <Textarea value={editingItemDraft.question} onChange={(event) => setEditingItemDraft((current) => ({ ...current, question: event.target.value }))} />
                            ) : item.question}
                          </td>
                          <td className="px-3 py-3">
                            {editingItemId === item.id ? (
                              <Textarea value={editingItemDraft.answer} onChange={(event) => setEditingItemDraft((current) => ({ ...current, answer: event.target.value }))} />
                            ) : item.answer || "-"}
                          </td>
                          <td className="px-3 py-3">
                            <Badge variant={item.answer.trim() ? "success" : "warning"}>
                              {item.answer.trim() ? "Ada jawaban default" : "Perlu jawaban"}
                            </Badge>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-2">
                              {canManage ? (
                                <>
                                  <Button type="button" size="icon" variant="outline" disabled={busy || item.order === 1} onClick={() => void moveItem(item, "up")}>
                                    <ArrowUp className="h-4 w-4" />
                                  </Button>
                                  <Button type="button" size="icon" variant="outline" disabled={busy || item.order === selectedTemplate.items.length} onClick={() => void moveItem(item, "down")}>
                                    <ArrowDown className="h-4 w-4" />
                                  </Button>
                                  {editingItemId === item.id ? (
                                    <Button type="button" size="sm" disabled={busy} onClick={() => void updateItem(item)}>
                                      <Save className="h-4 w-4" />
                                      Simpan
                                    </Button>
                                  ) : (
                                    <Button type="button" size="sm" variant="outline" onClick={() => {
                                      setEditingItemId(item.id);
                                      setEditingItemDraft({
                                        subjectType: item.subjectType ?? "saksi",
                                        answerMode: item.answerMode ?? "manual",
                                        sourceKey: item.sourceKey ?? "",
                                        question: item.question,
                                        answer: item.answer,
                                      });
                                    }}>
                                      edit
                                    </Button>
                                  )}
                                  <Button type="button" size="icon" variant="destructive" disabled={busy} onClick={() => void deleteItem(item)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="rounded-xl border border-border/80 bg-muted/20 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Preview output ke blangko/RTF</p>
                  <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-border/70 bg-background/70 p-3 text-sm leading-6 text-foreground">
                    {renderBasPreview(selectedTemplate) || "Belum ada item BAS."}
                  </pre>
                </div>

                {canManage ? (
                  <div className="grid gap-3 rounded-xl border border-border/80 p-3 lg:grid-cols-[160px_160px_1fr]">
                    <NativeSelect value={itemDraft.subjectType} onChange={(event) => setItemDraft((current) => ({ ...current, subjectType: event.target.value }))}>
                      <option value="saksi">Saksi</option>
                      <option value="pihak">Pihak</option>
                      <option value="ahli">Ahli</option>
                      <option value="umum">Umum</option>
                    </NativeSelect>
                    <NativeSelect value={itemDraft.answerMode} onChange={(event) => setItemDraft((current) => ({ ...current, answerMode: event.target.value }))}>
                      <option value="manual">Manual</option>
                      <option value="default">Default</option>
                      <option value="sipp">SIPP/source</option>
                    </NativeSelect>
                    <Input value={itemDraft.sourceKey} onChange={(event) => setItemDraft((current) => ({ ...current, sourceKey: event.target.value }))} placeholder="Source key jawaban, contoh saksi.penggugat.1.keterangan" />
                    <Textarea className="lg:col-span-2" value={itemDraft.question} onChange={(event) => setItemDraft((current) => ({ ...current, question: event.target.value }))} placeholder="Pertanyaan baru" />
                    <Textarea value={itemDraft.answer} onChange={(event) => setItemDraft((current) => ({ ...current, answer: event.target.value }))} placeholder="Jawaban default/manual opsional" />
                    <Button type="button" className="lg:col-span-3" disabled={busy || !itemDraft.question} onClick={addItem}>
                      <Plus className="h-4 w-4" />
                      Tambah Item BAS
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
