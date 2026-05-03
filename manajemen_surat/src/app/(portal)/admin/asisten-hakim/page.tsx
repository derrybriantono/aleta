"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, ExternalLink, Plus, Save, Scale, Sparkles, Trash2 } from "lucide-react";

import { AccessDeniedCard, PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  ASSISTANT_JUDGE_PROVIDER_ORDER,
  ASSISTANT_JUDGE_ROLE_OPTIONS,
  createAssistantJudgeLinkId,
  getAssistantJudgeOrderedLinks,
  normalizeAssistantJudgeConfig,
  validateAssistantJudgeUrl,
} from "@/lib/assistant-judge";
import { usePortal } from "@/lib/app-state";
import { getEffectiveRoleId, getUserPositionLabel, getUserRoleBadge } from "@/lib/permissions";
import type { AssistantJudgeConfig, AssistantJudgeLinkConfig, RoleId, UserPersona } from "@/lib/types";

function cloneConfig(config: AssistantJudgeConfig): AssistantJudgeConfig {
  const normalized = normalizeAssistantJudgeConfig(config);
  return normalizeAssistantJudgeConfig({
    ...normalized,
    visibleRoles: [...normalized.visibleRoles],
    links: Object.fromEntries(
      Object.entries(normalized.links).map(([id, link]) => [
        id,
        {
          ...link,
          allowedRoles: [...(link.allowedRoles ?? [])],
          allowedUserIds: [...(link.allowedUserIds ?? [])],
        },
      ])
    ),
  });
}

function buildNewLink(existingIds: string[]): AssistantJudgeLinkConfig {
  const id = createAssistantJudgeLinkId("Asisten AI Baru", existingIds);
  return {
    id,
    provider: id,
    iconKey: "sparkles",
    sortOrder: (existingIds.length + 1) * 10,
    enabled: false,
    label: "Asisten AI Baru",
    url: "",
    description: "Asisten AI tambahan.",
    allowedRoles: ["super-admin"],
    allowedUserIds: [],
    openInNewTab: true,
  };
}

function updateLinkInConfig(
  current: AssistantJudgeConfig,
  linkId: string,
  payload: Partial<AssistantJudgeLinkConfig>
): AssistantJudgeConfig {
  const currentLink = current.links[linkId];
  if (!currentLink) return current;

  return {
    ...current,
    links: {
      ...current.links,
      [linkId]: {
        ...currentLink,
        ...payload,
        allowedRoles: payload.allowedRoles ?? currentLink.allowedRoles,
        allowedUserIds: payload.allowedUserIds ?? currentLink.allowedUserIds,
      },
    },
  };
}

function toggleValue<T extends string>(values: T[] | undefined, value: T, checked: boolean) {
  const next = new Set(values ?? []);
  if (checked) {
    next.add(value);
  } else {
    next.delete(value);
  }
  return Array.from(next);
}

function getLinkStatus(link: AssistantJudgeLinkConfig) {
  if (!link.enabled) return { label: "Nonaktif", variant: "muted" as const };
  const validation = validateAssistantJudgeUrl(link.url);
  if (!validation.ok) return { label: "URL invalid", variant: "danger" as const };
  if (validation.warning) return { label: "Perlu cek domain", variant: "warning" as const };
  return { label: "Aktif", variant: "success" as const };
}

function sortUsers(users: UserPersona[]) {
  return [...users]
    .filter((user) => user.isActive)
    .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
}

export default function AssistantJudgeSettingsPage() {
  const { assistantJudgeConfig, currentUser, updateAssistantJudgeConfig, users } = usePortal();
  const roleId = getEffectiveRoleId(currentUser);
  const [draft, setDraft] = useState<AssistantJudgeConfig>(() => cloneConfig(assistantJudgeConfig));
  const [message, setMessage] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const orderedLinks = useMemo(() => getAssistantJudgeOrderedLinks(draft), [draft]);
  const activeUsers = useMemo(() => sortUsers(users), [users]);

  const validation = useMemo(() => {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const link of orderedLinks) {
      if (!link.enabled) continue;

      const result = validateAssistantJudgeUrl(link.url);
      if (!result.ok && result.message) {
        errors.push(`${link.label || link.id}: ${result.message}`);
      }
      if (result.warning) {
        warnings.push(`${link.label || link.id}: ${result.warning}`);
      }
      if (!link.label.trim()) {
        errors.push(`${link.id}: Label wajib diisi.`);
      }
      if (!link.description.trim()) {
        errors.push(`${link.label || link.id}: Deskripsi wajib diisi.`);
      }
      if ((link.allowedRoles ?? []).length === 0 && (link.allowedUserIds ?? []).length === 0) {
        errors.push(`${link.label || link.id}: Pilih minimal satu peran atau satu pengguna yang boleh mengakses.`);
      }
    }

    if (!draft.visibleRoles.includes("super-admin")) {
      errors.push("Super Admin harus selalu memiliki akses.");
    }

    return { errors, warnings };
  }, [draft.visibleRoles, orderedLinks]);

  if (roleId !== "super-admin") {
    return <AccessDeniedCard />;
  }

  const updateLink = (linkId: string, payload: Partial<AssistantJudgeLinkConfig>) => {
    setDraft((current) => updateLinkInConfig(current, linkId, payload));
  };

  const toggleGlobalRole = (targetRoleId: RoleId, checked: boolean) => {
    setDraft((current) => {
      const nextRoles = new Set(current.visibleRoles);
      if (checked) {
        nextRoles.add(targetRoleId);
      } else if (targetRoleId !== "super-admin") {
        nextRoles.delete(targetRoleId);
      }
      nextRoles.add("super-admin");
      return { ...current, visibleRoles: Array.from(nextRoles) };
    });
  };

  const toggleLinkRole = (linkId: string, targetRoleId: RoleId, checked: boolean) => {
    const link = draft.links[linkId];
    if (!link) return;
    const nextRoles = toggleValue(link.allowedRoles, targetRoleId, checked);
    if (targetRoleId !== "super-admin") {
      nextRoles.push("super-admin");
    }
    updateLink(linkId, { allowedRoles: Array.from(new Set(nextRoles)) });
  };

  const toggleLinkUser = (linkId: string, userId: string, checked: boolean) => {
    const link = draft.links[linkId];
    if (!link) return;
    updateLink(linkId, { allowedUserIds: toggleValue(link.allowedUserIds, userId, checked) });
  };

  const addLink = () => {
    setDraft((current) => {
      const ids = Object.keys(current.links);
      const link = buildNewLink(ids);
      return {
        ...current,
        links: {
          ...current.links,
          [link.id ?? link.provider ?? "ai-link"]: link,
        },
      };
    });
    setMessage({ type: "warning", text: "Menu AI baru ditambahkan dalam mode nonaktif. Isi URL lalu aktifkan saat siap." });
  };

  const disableLink = (linkId: string) => {
    updateLink(linkId, { enabled: false });
  };

  const saveSettings = async () => {
    setMessage(null);
    if (validation.errors.length > 0) {
      setMessage({ type: "error", text: validation.errors[0] });
      return;
    }

    setIsSaving(true);
    const result = await updateAssistantJudgeConfig(normalizeAssistantJudgeConfig(draft));
    setIsSaving(false);
    setMessage({ type: result.ok ? "success" : "error", text: result.message });
  };

  return (
    <div className="space-y-8">
      <PageIntro
        eyebrow="Pengaturan Aplikasi"
        title="Pengaturan Asisten Hakim"
        description="Super Admin dapat mengelola menu AI, link, urutan, dan akses peran/pengguna untuk Asisten Hakim."
        actions={
          <Button asChild variant="outline">
            <Link href="/admin">
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Admin
            </Link>
          </Button>
        }
      />

      {message ? (
        <div
          className={
            message.type === "success"
              ? "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200"
              : message.type === "warning"
                ? "rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"
                : "rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200"
          }
        >
          {message.text}
        </div>
      ) : null}

      <Card className="border-border/80">
        <CardHeader>
          <CardTitle>Kontrol Fitur</CardTitle>
          <CardDescription>
            Saat tidak aktif, halaman Asisten Hakim menampilkan status fitur belum tersedia. Pengaturan tetap dapat dibuka oleh Super Admin.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 lg:grid-cols-[1fr_18rem] lg:items-center">
          <div className="space-y-2">
            <p className="font-medium text-foreground">Aktifkan Asisten Hakim</p>
            <p className="text-sm leading-6 text-muted-foreground">
              Akses modul mengikuti peran umum di bawah, sedangkan akses tiap menu AI diatur pada masing-masing kartu.
            </p>
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-border/80 bg-card/70 p-4">
            <span className="text-sm font-medium text-foreground">{draft.enabled ? "Fitur aktif" : "Fitur nonaktif"}</span>
            <Switch checked={draft.enabled} onCheckedChange={(checked) => setDraft((current) => ({ ...current, enabled: checked }))} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80">
        <CardHeader>
          <CardTitle>Peran yang Dapat Melihat Modul</CardTitle>
          <CardDescription>Super Admin wajib tetap aktif. Akses setiap menu AI tetap difilter lagi berdasarkan peran dan pengguna.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {ASSISTANT_JUDGE_ROLE_OPTIONS.map((role) => {
            const checked = draft.visibleRoles.includes(role.roleId);
            return (
              <label key={role.roleId} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border/80 bg-card/70 p-4">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-primary"
                  checked={checked}
                  disabled={role.roleId === "super-admin"}
                  onChange={(event) => toggleGlobalRole(role.roleId, event.target.checked)}
                />
                <span className="space-y-1">
                  <span className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                    {role.label}
                    {role.roleId === "super-admin" ? <Badge variant="default">Wajib</Badge> : null}
                  </span>
                  <span className="block text-sm leading-6 text-muted-foreground">{role.description}</span>
                </span>
              </label>
            );
          })}
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Menu AI</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Kelola nama, URL, deskripsi, urutan, status aktif, dan siapa saja yang bisa membuka setiap menu.
            </p>
          </div>
          <Button onClick={addLink} variant="outline">
            <Plus className="h-4 w-4" />
            Tambah Menu AI
          </Button>
        </div>

        <div className="grid gap-5">
          {orderedLinks.map((link) => {
            const linkId = link.id ?? link.provider ?? link.label;
            const status = getLinkStatus(link);
            const isDefaultLink = ASSISTANT_JUDGE_PROVIDER_ORDER.includes(linkId);
            const urlValidation = link.enabled ? validateAssistantJudgeUrl(link.url) : null;
            const canPreviewLink = validateAssistantJudgeUrl(link.url).ok;

            return (
              <Card key={linkId} className="border-border/80">
                <CardHeader>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex gap-3">
                      <div className="h-fit rounded-2xl bg-violet-100 p-3 text-violet-700 dark:bg-violet-500/10 dark:text-violet-200">
                        {link.iconKey === "scale" ? <Scale className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                      </div>
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-lg">{link.label}</CardTitle>
                          <Badge variant={status.variant}>{status.label}</Badge>
                          {isDefaultLink ? <Badge variant="outline">Default</Badge> : <Badge variant="muted">Tambahan</Badge>}
                        </div>
                        <CardDescription>ID: {linkId}</CardDescription>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2 rounded-xl border border-border/80 px-3 py-2 text-sm font-medium">
                        Aktif
                        <Switch checked={link.enabled} onCheckedChange={(checked) => updateLink(linkId, { enabled: checked })} />
                      </label>
                      <Button variant="outline" size="sm" onClick={() => disableLink(linkId)} disabled={!link.enabled}>
                        <Trash2 className="h-4 w-4" />
                        Nonaktifkan
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  <div className="grid gap-4 lg:grid-cols-[1fr_7rem]">
                    <label className="space-y-2 text-sm font-medium text-foreground">
                      Nama/Label
                      <Input value={link.label} onChange={(event) => updateLink(linkId, { label: event.target.value })} />
                    </label>
                    <label className="space-y-2 text-sm font-medium text-foreground">
                      Urutan
                      <Input
                        type="number"
                        value={link.sortOrder ?? 0}
                        onChange={(event) => updateLink(linkId, { sortOrder: Number(event.target.value) || 0 })}
                      />
                    </label>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[1fr_12rem]">
                    <label className="space-y-2 text-sm font-medium text-foreground">
                      URL
                      <Input value={link.url} onChange={(event) => updateLink(linkId, { url: event.target.value })} placeholder="https://..." />
                    </label>
                    <label className="space-y-2 text-sm font-medium text-foreground">
                      Icon
                      <Input
                        value={link.iconKey ?? "sparkles"}
                        onChange={(event) => updateLink(linkId, { iconKey: event.target.value.trim() || "sparkles" })}
                        placeholder="sparkles / scale"
                      />
                    </label>
                  </div>

                  {urlValidation?.message ? <p className="text-xs leading-5 text-rose-600 dark:text-rose-300">{urlValidation.message}</p> : null}
                  {urlValidation?.warning ? <p className="text-xs leading-5 text-amber-600 dark:text-amber-300">{urlValidation.warning}</p> : null}

                  <label className="space-y-2 text-sm font-medium text-foreground">
                    Deskripsi singkat
                    <Textarea value={link.description} onChange={(event) => updateLink(linkId, { description: event.target.value })} rows={3} />
                  </label>

                  <div className="grid gap-5 xl:grid-cols-2">
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Peran yang boleh memakai menu ini</p>
                        <p className="text-xs leading-5 text-muted-foreground">Super Admin selalu disertakan untuk audit dan pemulihan konfigurasi.</p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {ASSISTANT_JUDGE_ROLE_OPTIONS.map((role) => {
                          const checked = link.allowedRoles?.includes(role.roleId) ?? false;
                          return (
                            <label key={role.roleId} className="flex items-start gap-2 rounded-xl border border-border/80 bg-muted/30 p-3 text-sm">
                              <input
                                type="checkbox"
                                className="mt-1 h-4 w-4 accent-primary"
                                checked={checked}
                                disabled={role.roleId === "super-admin"}
                                onChange={(event) => toggleLinkRole(linkId, role.roleId, event.target.checked)}
                              />
                              <span>
                                <span className="block font-medium text-foreground">{role.label}</span>
                                <span className="block text-xs leading-5 text-muted-foreground">{role.description}</span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Pengguna tertentu</p>
                        <p className="text-xs leading-5 text-muted-foreground">Pengguna aktif di daftar ini dapat mengakses menu walau peran umumnya tidak dipilih.</p>
                      </div>
                      <div className="max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-border/80 bg-muted/20 p-3">
                        {activeUsers.map((user) => {
                          const checked = link.allowedUserIds?.includes(user.id) ?? false;
                          return (
                            <label key={user.id} className="flex items-start gap-2 rounded-xl bg-card/70 p-3 text-sm">
                              <input
                                type="checkbox"
                                className="mt-1 h-4 w-4 accent-primary"
                                checked={checked}
                                onChange={(event) => toggleLinkUser(linkId, user.id, event.target.checked)}
                              />
                              <span className="min-w-0">
                                <span className="block truncate font-medium text-foreground">{user.name}</span>
                                <span className="block text-xs leading-5 text-muted-foreground">
                                  {getUserRoleBadge(user)} - {getUserPositionLabel(user)}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <label className="flex items-center gap-3 text-sm font-medium text-foreground">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary"
                        checked={link.openInNewTab !== false}
                        onChange={(event) => updateLink(linkId, { openInNewTab: event.target.checked })}
                      />
                      Buka di tab baru
                    </label>
                    {canPreviewLink ? (
                      <Button asChild variant="outline" size="sm">
                        <a href={link.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                          Preview Link
                        </a>
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" disabled>
                        <ExternalLink className="h-4 w-4" />
                        Preview Link
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {validation.warnings.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
          {validation.warnings[0]}
        </div>
      ) : null}

      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="outline" onClick={() => setDraft(cloneConfig(assistantJudgeConfig))} disabled={isSaving}>
          Batal
        </Button>
        <Button onClick={saveSettings} disabled={isSaving}>
          <Save className="h-4 w-4" />
          {isSaving ? "Menyimpan..." : "Simpan Pengaturan"}
        </Button>
      </div>
    </div>
  );
}
