"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Save, Scale } from "lucide-react";

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
  normalizeAssistantJudgeConfig,
  validateAssistantJudgeUrl,
} from "@/lib/assistant-judge";
import { usePortal } from "@/lib/app-state";
import { getEffectiveRoleId } from "@/lib/permissions";
import type { AssistantJudgeConfig, AssistantJudgeProviderId, RoleId } from "@/lib/types";

function cloneConfig(config: AssistantJudgeConfig): AssistantJudgeConfig {
  return normalizeAssistantJudgeConfig({
    ...config,
    visibleRoles: [...config.visibleRoles],
    links: {
      chatgpt: { ...config.links.chatgpt },
      gemini: { ...config.links.gemini },
      claude: { ...config.links.claude },
    },
  });
}

export default function AssistantJudgeSettingsPage() {
  const { assistantJudgeConfig, currentUser, updateAssistantJudgeConfig } = usePortal();
  const roleId = getEffectiveRoleId(currentUser);
  const [draft, setDraft] = useState<AssistantJudgeConfig>(() => cloneConfig(assistantJudgeConfig));
  const [message, setMessage] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const validation = useMemo(() => {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const providerId of ASSISTANT_JUDGE_PROVIDER_ORDER) {
      const link = draft.links[providerId];
      if (!link.enabled) continue;

      const result = validateAssistantJudgeUrl(link.url);
      if (!result.ok && result.message) {
        errors.push(`${link.label || providerId}: ${result.message}`);
      }
      if (result.warning) {
        warnings.push(`${link.label || providerId}: ${result.warning}`);
      }
      if (!link.label.trim()) {
        errors.push(`${providerId}: Label wajib diisi.`);
      }
      if (!link.description.trim()) {
        errors.push(`${link.label || providerId}: Deskripsi wajib diisi.`);
      }
    }

    if (!draft.visibleRoles.includes("super-admin")) {
      errors.push("Super Admin harus selalu memiliki akses.");
    }

    return { errors, warnings };
  }, [draft]);

  if (roleId !== "super-admin") {
    return <AccessDeniedCard />;
  }

  const updateProvider = (
    providerId: AssistantJudgeProviderId,
    payload: Partial<AssistantJudgeConfig["links"][AssistantJudgeProviderId]>
  ) => {
    setDraft((current) => ({
      ...current,
      links: {
        ...current.links,
        [providerId]: {
          ...current.links[providerId],
          ...payload,
        },
      },
    }));
  };

  const toggleRole = (targetRoleId: RoleId, checked: boolean) => {
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
        description="Atur link AI dan role yang boleh melihat aplikasi Asisten Hakim di Grid Aplikasi ALETA."
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
              : "rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200"
          }
        >
          {message.text}
        </div>
      ) : null}

      <Card className="border-border/80">
        <CardHeader>
          <CardTitle>Kontrol Fitur</CardTitle>
          <CardDescription>Jika dinonaktifkan, aplikasi Asisten Hakim tidak muncul di Grid Aplikasi dan route menampilkan status tidak aktif.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-foreground">Aktifkan Asisten Hakim</p>
            <p className="text-sm leading-6 text-muted-foreground">Super Admin tetap dapat membuka pengaturan ini untuk mengaktifkan kembali fitur.</p>
          </div>
          <Switch checked={draft.enabled} onCheckedChange={(checked) => setDraft((current) => ({ ...current, enabled: checked }))} />
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        {ASSISTANT_JUDGE_PROVIDER_ORDER.map((providerId) => {
          const link = draft.links[providerId];
          const urlValidation = link.enabled ? validateAssistantJudgeUrl(link.url) : null;

          return (
            <Card key={providerId} className="border-border/80">
              <CardHeader>
                <div className="mb-2 w-fit rounded-2xl bg-violet-100 p-3 text-violet-700 dark:bg-violet-500/10 dark:text-violet-200">
                  <Scale className="h-5 w-5" />
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{providerId === "chatgpt" ? "ChatGPT" : providerId === "gemini" ? "Gemini" : "Claude"}</CardTitle>
                    <CardDescription>Link yang dibuka user dari halaman Asisten Hakim.</CardDescription>
                  </div>
                  <Switch checked={link.enabled} onCheckedChange={(checked) => updateProvider(providerId, { enabled: checked })} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <label className="space-y-2 text-sm font-medium text-foreground">
                  Label
                  <Input value={link.label} onChange={(event) => updateProvider(providerId, { label: event.target.value })} />
                </label>
                <label className="space-y-2 text-sm font-medium text-foreground">
                  URL
                  <Input value={link.url} onChange={(event) => updateProvider(providerId, { url: event.target.value })} placeholder="https://..." />
                </label>
                {urlValidation?.warning ? <p className="text-xs leading-5 text-amber-600 dark:text-amber-300">{urlValidation.warning}</p> : null}
                <label className="space-y-2 text-sm font-medium text-foreground">
                  Deskripsi
                  <Textarea value={link.description} onChange={(event) => updateProvider(providerId, { description: event.target.value })} rows={4} />
                </label>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-border/80">
        <CardHeader>
          <CardTitle>Role yang Dapat Melihat</CardTitle>
          <CardDescription>Default akses: Super Admin, Admin, Ketua, Wakil Ketua, dan Hakim. Super Admin tidak dapat dihapus dari daftar akses.</CardDescription>
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
                  onChange={(event) => toggleRole(role.roleId, event.target.checked)}
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
