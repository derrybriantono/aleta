"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Link2, RefreshCw, Search, ShieldCheck, Unlink, UsersRound } from "lucide-react";

import { JlfLoadingState } from "@/components/portal/judicia/legal-form/jlf-foundation";
import { AccessDeniedCard, EmptyState, PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiPath } from "@/lib/base-path";
import { usePortal } from "@/lib/app-state";
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

type AccountLink = {
  id: string;
  aletaUserId: string;
  aletaUserName: string;
  sippUser: {
    id: string;
    username: string;
    fullname: string;
    nip?: string;
    email?: string;
    groupId?: string;
    groupName?: string;
    satkerName?: string;
  };
  linkStatus: string;
  linkMethod: string;
  confidenceScore: number;
  matchedFields: string[];
  updatedAt: string;
};

type SippUser = AccountLink["sippUser"];

async function readApi<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error?.message ?? "Permintaan JLF belum berhasil.");
  }
  return payload?.data as T;
}

function statusVariant(status: string) {
  if (status === "linked") return "success";
  if (status === "conflict" || status === "rejected") return "danger";
  if (status === "suggested" || status === "pending_approval") return "warning";
  return "outline";
}

export default function JudiciaLegalFormAccountSyncPage() {
  const { currentUser, positions } = usePortal();
  const [links, setLinks] = useState<AccountLink[]>([]);
  const [sippUsers, setSippUsers] = useState<SippUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [targetAletaUserId, setTargetAletaUserId] = useState("");
  const [selectedSippUserId, setSelectedSippUserId] = useState("");

  const effectiveRoleId = getEffectiveRoleId(currentUser);
  const access = resolveJudiciaLegalFormAccess(currentUser, {
    effectiveRoleId,
    positionLabel: getUserPositionLabel(currentUser, positions),
  });
  const canView = hasJudiciaLegalFormPermission(access, JLF_PERMISSION.ACCOUNT_SYNC_VIEW);
  const canManage = hasJudiciaLegalFormPermission(access, JLF_PERMISSION.ACCOUNT_SYNC_MANAGE);

  const currentUserId = currentUser?.id ?? "";
  const effectiveTargetUserId = targetAletaUserId || currentUserId;

  const loadLinks = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (!canManage && currentUserId) params.set("aletaUserId", currentUserId);
      const data = await readApi<{ items: AccountLink[] }>(
        await fetch(apiPath(`/api/judicia/legal-form/account-sync?${params.toString()}`), {
          cache: "no-store",
          credentials: "include",
        })
      );
      setLinks(data.items ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat link akun.");
    } finally {
      setLoading(false);
    }
  }, [canManage, canView, currentUserId]);

  useEffect(() => {
    if (!canView) return;
    const timer = window.setTimeout(() => {
      void loadLinks();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [canView, loadLinks]);

  const linkedCount = useMemo(() => links.filter((item) => item.linkStatus === "linked").length, [links]);
  const conflictCount = useMemo(() => links.filter((item) => item.linkStatus === "conflict").length, [links]);

  async function runAction(label: string, action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
      setMessage(label);
      await loadLinks();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Aksi JLF gagal.");
    } finally {
      setBusy(false);
    }
  }

  async function suggestLinks() {
    await runAction("Saran link akun selesai diproses.", async () => {
      await readApi(
        await fetch(apiPath("/api/judicia/legal-form/account-sync/suggest"), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ aletaUserId: effectiveTargetUserId }),
        })
      );
    });
  }

  async function searchSippUsers() {
    await runAction("Pencarian user SIPP selesai.", async () => {
      const params = new URLSearchParams({ query: searchQuery, limit: "10" });
      const data = await readApi<{ items: SippUser[] }>(
        await fetch(apiPath(`/api/judicia/legal-form/sipp/users/search?${params.toString()}`), {
          cache: "no-store",
          credentials: "include",
        })
      );
      setSippUsers(data.items ?? []);
    });
  }

  async function manualLink() {
    await runAction("Manual link akun berhasil diproses.", async () => {
      await readApi(
        await fetch(apiPath("/api/judicia/legal-form/account-sync/manual-link"), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ aletaUserId: effectiveTargetUserId, sippUserId: selectedSippUserId }),
        })
      );
    });
  }

  async function mutateLink(id: string, action: "approve" | "reject" | "unlink") {
    await runAction("Status link akun diperbarui.", async () => {
      await readApi(
        await fetch(apiPath(`/api/judicia/legal-form/account-sync/${encodeURIComponent(id)}/${action}`), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "Diproses dari UI Sinergi Akun SIPP." }),
        })
      );
    });
  }

  if (!currentUser) return <JlfLoadingState />;
  if (!canView) return <AccessDeniedCard />;

  return (
    <div className="space-y-8">
      <PageIntro
        eyebrow="ALETA Judicia"
        title="Sinergi Akun SIPP"
        description="Link akun ALETA dengan user SIPP secara aman. Data SIPP hanya dibaca melalui adapter dan tidak mengambil password atau hash."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={JUDICIA_LEGAL_FORM_ROUTE}>
                <ArrowLeft className="h-4 w-4" />
                Dashboard
              </Link>
            </Button>
            {canManage ? (
              <Button asChild variant="outline">
                <Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/account-sync/role-mapping`}>
                  <ShieldCheck className="h-4 w-4" />
                  Mapping Role
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/80">
          <CardHeader>
            <CardDescription>Total Link</CardDescription>
            <CardTitle className="text-3xl">{links.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border/80">
          <CardHeader>
            <CardDescription>Linked</CardDescription>
            <CardTitle className="text-3xl">{linkedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border/80">
          <CardHeader>
            <CardDescription>Conflict</CardDescription>
            <CardTitle className="text-3xl">{conflictCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {message ? (
        <Card className="border-border/80">
          <CardContent className="p-4 text-sm text-muted-foreground">{message}</CardContent>
        </Card>
      ) : null}

      {canManage ? (
        <Card className="border-border/80">
          <CardHeader>
            <CardTitle>Kelola Link Akun</CardTitle>
            <CardDescription>
              Admin dapat meminta saran kandidat atau mencari user SIPP dari adapter aman. Bila adapter belum aktif, hasil akan kosong.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
            <Input
              value={targetAletaUserId}
              onChange={(event) => setTargetAletaUserId(event.target.value)}
              placeholder="ID user ALETA"
              aria-label="ID user ALETA"
            />
            <Button type="button" variant="outline" disabled={busy || !effectiveTargetUserId} onClick={suggestLinks}>
              <Link2 className="h-4 w-4" />
              Suggest Link
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={loadLinks}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>

            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Cari username/NIP/nama/email SIPP"
              aria-label="Cari user SIPP"
              className="lg:col-span-2"
            />
            <Button type="button" disabled={busy || searchQuery.trim().length < 2} onClick={searchSippUsers}>
              <Search className="h-4 w-4" />
              Cari SIPP
            </Button>
          </CardContent>

          {sippUsers.length > 0 ? (
            <CardContent className="border-t border-border/80 pt-4">
              <div className="grid gap-3">
                {sippUsers.map((user) => (
                  <div key={user.id} className="flex flex-col gap-3 rounded-xl border border-border/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{user.fullname || user.username}</p>
                      <p className="text-sm text-muted-foreground">
                        {user.username} {user.nip ? `- NIP ${user.nip}` : ""} {user.groupName ? `- ${user.groupName}` : ""}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant={selectedSippUserId === user.id ? "default" : "outline"}
                      onClick={() => setSelectedSippUserId(user.id)}
                    >
                      <UsersRound className="h-4 w-4" />
                      Pilih
                    </Button>
                  </div>
                ))}
                <Button type="button" disabled={busy || !selectedSippUserId || !effectiveTargetUserId} onClick={manualLink}>
                  <Link2 className="h-4 w-4" />
                  Manual Link User Terpilih
                </Button>
              </div>
            </CardContent>
          ) : null}
        </Card>
      ) : null}

      <Card className="border-border/80">
        <CardHeader>
          <CardTitle>Daftar Link Akun</CardTitle>
          <CardDescription>
            User biasa hanya melihat area kerja yang diizinkan. Admin dapat memproses suggested, conflict, dan linked account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <JlfLoadingState />
          ) : links.length === 0 ? (
            <EmptyState
              title="Belum ada link akun"
              description="Tidak ada link ALETA-SIPP yang tersedia untuk cakupan akses saat ini."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="border-b border-border text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3 font-medium">Akun ALETA</th>
                    <th className="px-3 py-3 font-medium">User SIPP</th>
                    <th className="px-3 py-3 font-medium">Group</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3 font-medium">Confidence</th>
                    <th className="px-3 py-3 font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {links.map((link) => (
                    <tr key={link.id} className="border-b border-border/70">
                      <td className="px-3 py-4">
                        <p className="font-medium text-foreground">{link.aletaUserName}</p>
                        <p className="text-xs text-muted-foreground">{link.aletaUserId}</p>
                      </td>
                      <td className="px-3 py-4">
                        <p className="font-medium text-foreground">{link.sippUser.fullname || link.sippUser.username}</p>
                        <p className="text-xs text-muted-foreground">
                          {link.sippUser.username} {link.sippUser.nip ? `- ${link.sippUser.nip}` : ""}
                        </p>
                      </td>
                      <td className="px-3 py-4 text-muted-foreground">{link.sippUser.groupName || "-"}</td>
                      <td className="px-3 py-4">
                        <Badge variant={statusVariant(link.linkStatus)}>{link.linkStatus}</Badge>
                      </td>
                      <td className="px-3 py-4">{link.confidenceScore}%</td>
                      <td className="px-3 py-4">
                        {canManage ? (
                          <div className="flex flex-wrap gap-2">
                            {link.linkStatus !== "linked" ? (
                              <>
                                <Button size="sm" variant="outline" disabled={busy} onClick={() => mutateLink(link.id, "approve")}>
                                  Approve
                                </Button>
                                <Button size="sm" variant="outline" disabled={busy} onClick={() => mutateLink(link.id, "reject")}>
                                  Reject
                                </Button>
                              </>
                            ) : (
                              <Button size="sm" variant="outline" disabled={busy} onClick={() => mutateLink(link.id, "unlink")}>
                                <Unlink className="h-3.5 w-3.5" />
                                Unlink
                              </Button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Read-only</span>
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
