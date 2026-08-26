"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Plus, RefreshCw, ShieldCheck } from "lucide-react";

import { JlfLoadingState } from "@/components/portal/judicia/legal-form/jlf-foundation";
import { AccessDeniedCard, EmptyState, PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { apiPath } from "@/lib/base-path";
import { usePortal } from "@/lib/app-state";
import {
  hasJudiciaLegalFormPermission,
  JLF_PERMISSION,
  JUDICIA_LEGAL_FORM_ROUTE,
  resolveJudiciaLegalFormAccess,
} from "@/lib/judicia-legal-form-types";
import { getEffectiveRoleId, getUserPositionLabel } from "@/lib/permissions";
import type { RoleId } from "@/lib/types";

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { message?: string };
};

type RoleMapping = {
  id: string;
  sippGroupId: string;
  sippGroupName: string;
  suggestedAletaRoleId: RoleId | null;
  suggestedAletaRoleLabel: string;
  suggestedPermissions: string[];
  isAutoApply: boolean;
  requiresAdminApproval: boolean;
  isActive: boolean;
  description: string;
};

const roleOptions: Array<{ id: RoleId; label: string }> = [
  { id: "admin", label: "Admin" },
  { id: "ketua", label: "Ketua" },
  { id: "wakil-ketua", label: "Wakil Ketua" },
  { id: "hakim", label: "Hakim" },
  { id: "panitera", label: "Panitera" },
  { id: "panitera-muda", label: "Panitera Muda" },
  { id: "panitera-pengganti", label: "Panitera Pengganti" },
  { id: "jurusita", label: "Jurusita" },
  { id: "pppk", label: "PPPK" },
  { id: "staf", label: "Staf" },
];

async function readApi<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error?.message ?? "Permintaan mapping role belum berhasil.");
  }
  return payload?.data as T;
}

export default function JudiciaLegalFormRoleMappingPage() {
  const { currentUser, positions } = usePortal();
  const [items, setItems] = useState<RoleMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    sippGroupId: "",
    sippGroupName: "",
    suggestedAletaRoleId: "staf" as RoleId,
    suggestedPermissions: "judicia_legal_form.view, judicia_legal_form.dashboard.view",
    description: "",
  });

  const access = resolveJudiciaLegalFormAccess(currentUser, {
    effectiveRoleId: getEffectiveRoleId(currentUser),
    positionLabel: getUserPositionLabel(currentUser, positions),
  });
  const canManage = hasJudiciaLegalFormPermission(access, JLF_PERMISSION.SIPP_ROLE_MAPPING_MANAGE);

  const loadMappings = useCallback(async () => {
    if (!canManage) return;
    setLoading(true);
    try {
      const data = await readApi<{ items: RoleMapping[] }>(
        await fetch(apiPath("/api/judicia/legal-form/account-sync/role-mapping"), {
          cache: "no-store",
          credentials: "include",
        })
      );
      setItems(data.items ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat mapping role.");
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    if (!canManage) return;
    const timer = window.setTimeout(() => {
      void loadMappings();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [canManage, loadMappings]);

  async function submitMapping() {
    setBusy(true);
    setMessage("");
    try {
      await readApi(
        await fetch(apiPath("/api/judicia/legal-form/account-sync/role-mapping"), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            suggestedPermissions: form.suggestedPermissions
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean),
          }),
        })
      );
      setForm({
        sippGroupId: "",
        sippGroupName: "",
        suggestedAletaRoleId: "staf",
        suggestedPermissions: "judicia_legal_form.view, judicia_legal_form.dashboard.view",
        description: "",
      });
      setMessage("Mapping role SIPP berhasil ditambahkan.");
      await loadMappings();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menyimpan mapping role.");
    } finally {
      setBusy(false);
    }
  }

  async function disableMapping(id: string) {
    setBusy(true);
    setMessage("");
    try {
      await readApi(
        await fetch(apiPath("/api/judicia/legal-form/account-sync/role-mapping"), {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, action: "disable" }),
        })
      );
      setMessage("Mapping role dinonaktifkan.");
      await loadMappings();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menonaktifkan mapping.");
    } finally {
      setBusy(false);
    }
  }

  if (!currentUser) return <JlfLoadingState />;
  if (!canManage) return <AccessDeniedCard />;

  return (
    <div className="space-y-8">
      <PageIntro
        eyebrow="Sinergi Akun SIPP"
        title="Mapping Role SIPP ke ALETA"
        description="Mapping ini disiapkan sebagai rekomendasi admin. Auto-apply default nonaktif dan tetap membutuhkan approval."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/account-sync`}>
                <ArrowLeft className="h-4 w-4" />
                Sinergi Akun
              </Link>
            </Button>
            <Button type="button" variant="outline" onClick={loadMappings} disabled={busy}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        }
      />

      {message ? (
        <Card className="border-border/80">
          <CardContent className="p-4 text-sm text-muted-foreground">{message}</CardContent>
        </Card>
      ) : null}

      <Card className="border-border/80">
        <CardHeader>
          <CardTitle>Tambah Mapping</CardTitle>
          <CardDescription>
            Simpan group SIPP, role rekomendasi ALETA, dan permission dasar yang disarankan.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Input
            value={form.sippGroupId}
            onChange={(event) => setForm((current) => ({ ...current, sippGroupId: event.target.value }))}
            placeholder="ID group SIPP"
            aria-label="ID group SIPP"
          />
          <Input
            value={form.sippGroupName}
            onChange={(event) => setForm((current) => ({ ...current, sippGroupName: event.target.value }))}
            placeholder="Nama group SIPP"
            aria-label="Nama group SIPP"
          />
          <NativeSelect
            value={form.suggestedAletaRoleId}
            onChange={(event) => setForm((current) => ({ ...current, suggestedAletaRoleId: event.target.value as RoleId }))}
            aria-label="Role ALETA yang disarankan"
          >
            {roleOptions.map((role) => (
              <option key={role.id} value={role.id}>
                {role.label}
              </option>
            ))}
          </NativeSelect>
          <Input
            value={form.suggestedPermissions}
            onChange={(event) => setForm((current) => ({ ...current, suggestedPermissions: event.target.value }))}
            placeholder="Permission disarankan, pisahkan dengan koma"
            aria-label="Permission disarankan"
          />
          <Input
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            placeholder="Catatan mapping"
            aria-label="Catatan mapping"
            className="md:col-span-2"
          />
          <Button
            type="button"
            disabled={busy || !form.sippGroupId.trim() || !form.sippGroupName.trim()}
            onClick={submitMapping}
            className="md:col-span-2"
          >
            <Plus className="h-4 w-4" />
            Tambah Mapping
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/80">
        <CardHeader>
          <CardTitle>Daftar Mapping</CardTitle>
          <CardDescription>
            Mapping tidak langsung mengubah role user. Tahap ini hanya menyimpan rekomendasi aman untuk admin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <JlfLoadingState />
          ) : items.length === 0 ? (
            <EmptyState title="Belum ada mapping role" description="Tambahkan group SIPP untuk mulai menyiapkan rekomendasi role ALETA." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="border-b border-border text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3 font-medium">Group SIPP</th>
                    <th className="px-3 py-3 font-medium">Role ALETA</th>
                    <th className="px-3 py-3 font-medium">Permission</th>
                    <th className="px-3 py-3 font-medium">Approval</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3 font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-border/70">
                      <td className="px-3 py-4">
                        <p className="font-medium text-foreground">{item.sippGroupName}</p>
                        <p className="text-xs text-muted-foreground">{item.sippGroupId}</p>
                      </td>
                      <td className="px-3 py-4">{item.suggestedAletaRoleLabel}</td>
                      <td className="px-3 py-4 text-xs text-muted-foreground">
                        {item.suggestedPermissions.length ? item.suggestedPermissions.join(", ") : "-"}
                      </td>
                      <td className="px-3 py-4">
                        <Badge variant={item.requiresAdminApproval ? "warning" : "outline"}>
                          {item.requiresAdminApproval ? "Butuh approval" : "Tidak otomatis"}
                        </Badge>
                      </td>
                      <td className="px-3 py-4">
                        <Badge variant={item.isActive ? "success" : "muted"}>{item.isActive ? "Aktif" : "Nonaktif"}</Badge>
                      </td>
                      <td className="px-3 py-4">
                        {item.isActive ? (
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => disableMapping(item.id)}>
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Nonaktifkan
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Nonaktif</span>
                        )}
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
