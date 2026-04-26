"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpDown, Camera, CheckCircle2, KeyRound, LoaderCircle, Save, Smartphone, UserPlus, UserRound, XCircle } from "lucide-react";

import { UserAvatar } from "@/components/portal/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePortal } from "@/lib/app-state";
import { modules, positions, roles } from "@/lib/mock-data";
import { getDefaultRoleForPosition, getRoleLabel, getUserPositionLabel, getUserRoleBadge, isPrivilegedAdmin } from "@/lib/permissions";
import { type ModuleVisibility, type UserPersona } from "@/lib/types";

type AdminResetRequest = {
  id: string;
  userId: string;
  username: string;
  name: string;
  nip: string;
  status: "pending" | "approved" | "rejected";
  note: string | null;
  resolvedByUserId: string | null;
  createdAt: string;
  expiresAt: string;
};

type AccountSortKey = "name" | "username" | "position" | "nip" | "email" | "status" | "role";

function sortManagedUsers(users: UserPersona[], sortKey: AccountSortKey, sortDir: "asc" | "desc") {
  const sorted = [...users].sort((left, right) => {
    if (sortKey === "status") {
      if (left.isActive !== right.isActive) {
        return left.isActive ? -1 : 1;
      }
      return left.name.localeCompare(right.name);
    }
    if (sortKey === "position") {
      return getUserPositionLabel(left).localeCompare(getUserPositionLabel(right));
    }
    if (sortKey === "nip") {
      return (left.nip ?? "").localeCompare(right.nip ?? "");
    }
    if (sortKey === "email") {
      return (left.email ?? "").localeCompare(right.email ?? "");
    }
    if (sortKey === "role") {
      return getRoleLabel(left.roleId).localeCompare(getRoleLabel(right.roleId));
    }
    return (left[sortKey] ?? "").localeCompare(right[sortKey] ?? "");
  });
  return sortDir === "desc" ? sorted.reverse() : sorted;
}

export function MappingBoard() {
  const { createManagedUser, currentUser, updateManagedUser, users } = usePortal();
  const isAdmin = isPrivilegedAdmin(currentUser);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<AccountSortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const filteredUsers = useMemo(() => {
    const visibleUsers =
      currentUser?.roleId === "super-admin"
        ? users
        : users.filter((user) => user.roleId !== "super-admin");

    const searchedUsers = visibleUsers.filter((user) =>
      [user.name, user.username, user.email, user.nip, user.whatsappNumber]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase())
    );

    return sortManagedUsers(searchedUsers, sortKey, sortDir);
  }, [currentUser?.roleId, query, sortDir, sortKey, users]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const selectedUser =
    filteredUsers.find((user) => user.id === selectedUserId) ??
    filteredUsers[0] ??
    null;

  // Admin reset state
  const [isResettingUserId, setIsResettingUserId] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<{ userId: string; tempPassword: string } | null>(null);
  const [resetError, setResetError] = useState("");

  // Admin reset requests state
  const [pendingRequests, setPendingRequests] = useState<AdminResetRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [requestsTab, setRequestsTab] = useState(false);
  const [resolveState, setResolveState] = useState<{ requestId: string; action: "approve" | "reject" } | null>(null);
  const [resolveNote, setResolveNote] = useState("");
  const [resolveResult, setResolveResult] = useState<{ requestId: string; tempPassword?: string; action: string } | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  const loadResetRequests = async () => {
    setIsLoadingRequests(true);
    try {
      const response = await fetch("/api/users/recovery/admin-requests", { credentials: "include" });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; data?: { requests: AdminResetRequest[] }; error?: { message?: string } }
        | null;
      if (response.ok && payload?.ok && payload.data?.requests) {
        setPendingRequests(payload.data.requests);
      }
    } catch {
      // non-blocking
    } finally {
      setIsLoadingRequests(false);
    }
  };

  useEffect(() => {
    if (isAdmin && requestsTab) {
      void loadResetRequests();
    }
  }, [isAdmin, requestsTab]);

  const handleAdminReset = async (targetUserId: string) => {
    setIsResettingUserId(targetUserId);
    setResetResult(null);
    setResetError("");
    try {
      const response = await fetch(`/api/users/${targetUserId}/reset-password`, {
        method: "POST",
        credentials: "include",
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; data?: { tempPassword: string; message: string }; error?: { message?: string } }
        | null;
      if (!response.ok || !payload?.ok || !payload.data) {
        throw new Error(payload?.error?.message ?? "Reset password gagal diproses.");
      }
      setResetResult({ userId: targetUserId, tempPassword: payload.data.tempPassword });
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Reset password gagal diproses.");
    } finally {
      setIsResettingUserId(null);
    }
  };

  const handleResolveRequest = async (requestId: string, action: "approve" | "reject") => {
    setIsResolving(true);
    try {
      const response = await fetch(`/api/users/recovery/admin-requests/${requestId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action, note: resolveNote }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; data?: { tempPassword?: string; action: string }; error?: { message?: string } }
        | null;
      if (!response.ok || !payload?.ok || !payload.data) {
        throw new Error(payload?.error?.message ?? "Gagal memproses permintaan.");
      }
      setResolveResult({ requestId, tempPassword: payload.data.tempPassword, action });
      setResolveState(null);
      setResolveNote("");
      await loadResetRequests();
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Gagal memproses permintaan.");
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr] xl:items-start">
      <Card className="border-border/80 xl:sticky xl:top-4">

        <CardHeader>
          <CardTitle>Daftar Akun</CardTitle>
          <CardDescription>Pilih akun untuk diperbarui atau gunakan tab akun baru untuk menambah user terpusat.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari nama, username, email, NIP, atau nomor WA..."
              className="h-12 text-base"
            />
            <div className="flex items-center gap-2 rounded-[1.1rem] border border-border bg-muted/35 px-3">
              <ArrowUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              <NativeSelect
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value as AccountSortKey)}
                className="h-12 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
              >
                <option value="name">Nama</option>
                <option value="username">Username</option>
                <option value="position">Jabatan</option>
                <option value="role">Role</option>
                <option value="nip">NIP</option>
                <option value="email">Email</option>
                <option value="status">Status</option>
              </NativeSelect>
              <button
                type="button"
                className="shrink-0 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
                onClick={() => setSortDir((dir) => (dir === "asc" ? "desc" : "asc"))}
              >
                {sortDir === "asc" ? "A→Z" : "Z→A"}
              </button>
            </div>
          </div>

          <div className="max-h-[calc(100vh-18rem)] space-y-2 overflow-y-auto pr-1">
            {filteredUsers.map((user) => {
              const canReset =
                isAdmin &&
                (currentUser?.roleId === "super-admin" || user.roleId !== "super-admin") &&
                currentUser?.id !== user.id;
              return (
                <div key={user.id} className="space-y-1">
                  <button
                    type="button"
                    className={`w-full rounded-[1.2rem] border px-4 py-4 text-left transition ${
                      selectedUserId === user.id
                        ? "border-primary/40 bg-primary/10"
                        : "border-border bg-card hover:border-primary/30 hover:bg-primary/5"
                    }`}
                    onClick={() => setSelectedUserId(user.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <UserAvatar
                          name={user.name}
                          profilePhotoUrl={user.profilePhotoUrl}
                          className="h-11 w-11 rounded-2xl"
                          textClassName="text-sm"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-foreground">{user.name}</p>
                          <p className="mt-1 truncate text-sm text-muted-foreground">{user.username}</p>
                          <p className="mt-1 truncate text-sm text-muted-foreground">{user.email || "Data email dilindungi"}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant="outline">{getUserRoleBadge(user)}</Badge>
                        {!user.isActive ? <Badge variant="danger">Diblokir</Badge> : null}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {user.nip?.trim() ? <span>NIP {user.nip}</span> : <span>Tanpa NIP</span>}
                      <span>-</span>
                      <span>{getUserPositionLabel(user)}</span>
                    </div>
                  </button>

                  {canReset ? (
                    <div className="px-1">
                      <button
                        type="button"
                        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
                        disabled={isResettingUserId === user.id}
                        onClick={() => {
                          setResetResult(null);
                          setResetError("");
                          void handleAdminReset(user.id);
                        }}
                      >
                        {isResettingUserId === user.id ? (
                          <LoaderCircle className="h-3 w-3 animate-spin" />
                        ) : (
                          <KeyRound className="h-3 w-3" />
                        )}
                        Reset Password
                      </button>
                    </div>
                  ) : null}

                  {resetResult?.userId === user.id ? (
                    <div className="mx-1 rounded-[1rem] border border-amber-300/60 bg-amber-50 p-3 dark:bg-amber-950/30">
                      <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">Password Sementara (tampil sekali — simpan sebelum ditutup)</p>
                      <p className="mt-1 font-mono text-base font-bold tracking-widest text-amber-900 dark:text-amber-100">{resetResult.tempPassword}</p>
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Sampaikan ke user secara langsung dan minta segera diganti.</p>
                      <button
                        type="button"
                        className="mt-2 text-xs text-amber-600 underline dark:text-amber-400"
                        onClick={() => setResetResult(null)}
                      >
                        Tutup
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
            {resetError ? (
              <div className="rounded-2xl border border-rose-300/60 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-200">
                {resetError}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="xl:sticky xl:top-4">
      <Tabs defaultValue="edit" onValueChange={(value) => setRequestsTab(value === "requests")}>
        <TabsList className={`grid w-full ${isAdmin ? "grid-cols-3" : "grid-cols-2"}`}>
          <TabsTrigger value="edit">Edit Akun</TabsTrigger>
          <TabsTrigger value="create">Buat Akun Baru</TabsTrigger>
          {isAdmin ? <TabsTrigger value="requests">Permintaan Reset</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="edit">
          <Card className="border-border/80">
            <CardHeader>
              <CardTitle>Edit Akun</CardTitle>
              <CardDescription>Kolom bertanda merah wajib diisi. Password cukup diisi bila memang ingin diganti, sehingga admin tetap bisa mengedit data akun tanpa menebak sandi lama.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {!selectedUser ? (
                <div className="rounded-[1.2rem] border border-border bg-muted/35 px-4 py-5 text-sm text-muted-foreground">
                  Tidak ada akun yang cocok dengan pencarian saat ini.
                </div>
              ) : (
                <ManagedUserEditor key={selectedUser.id} user={selectedUser} onSave={updateManagedUser} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="create">
          <Card className="border-border/80">
            <CardHeader>
              <CardTitle>Buat Akun Baru</CardTitle>
              <CardDescription>Factory akun terpusat untuk menambah user baru dengan data identitas lengkap dan foto profil.</CardDescription>
            </CardHeader>
            <CardContent>
              <ManagedUserFactory onCreate={createManagedUser} />
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin ? (
          <TabsContent value="requests">
            <Card className="border-border/80">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>Permintaan Reset Password</CardTitle>
                    <CardDescription>Permintaan dari user yang tidak bisa menggunakan OTP WhatsApp. Setujui untuk membuat password sementara otomatis.</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isLoadingRequests}
                    onClick={() => void loadResetRequests()}
                  >
                    {isLoadingRequests ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Refresh"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoadingRequests ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                    <LoaderCircle className="h-5 w-5 animate-spin" />
                    Memuat permintaan...
                  </div>
                ) : pendingRequests.length === 0 ? (
                  <div className="rounded-[1.2rem] border border-border bg-muted/35 px-4 py-5 text-sm text-muted-foreground">
                    Tidak ada permintaan reset password yang aktif saat ini.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingRequests.map((req) => (
                      <div key={req.id} className="space-y-3 rounded-[1.2rem] border border-border bg-card p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <p className="truncate font-semibold text-foreground">{req.name}</p>
                            <p className="text-sm text-muted-foreground">{req.username} — NIP {req.nip}</p>
                            <p className="text-xs text-muted-foreground">
                              Diajukan {new Date(req.createdAt).toLocaleString("id-ID")}
                            </p>
                          </div>
                          <Badge
                            variant={
                              req.status === "approved"
                                ? "success"
                                : req.status === "rejected"
                                ? "danger"
                                : "outline"
                            }
                          >
                            {req.status === "pending" ? "Menunggu" : req.status === "approved" ? "Disetujui" : "Ditolak"}
                          </Badge>
                        </div>

                        {resolveResult?.requestId === req.id && resolveResult.action === "approve" && resolveResult.tempPassword ? (
                          <div className="rounded-[1rem] border border-amber-300/60 bg-amber-50 p-3 dark:bg-amber-950/30">
                            <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                              Password Sementara (tampil sekali — simpan sebelum ditutup)
                            </p>
                            <p className="mt-1 font-mono text-base font-bold tracking-widest text-amber-900 dark:text-amber-100">
                              {resolveResult.tempPassword}
                            </p>
                            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                              Sampaikan ke user secara langsung dan minta segera diganti.
                            </p>
                            <button
                              type="button"
                              className="mt-2 text-xs text-amber-600 underline dark:text-amber-400"
                              onClick={() => setResolveResult(null)}
                            >
                              Tutup
                            </button>
                          </div>
                        ) : null}

                        {resolveResult?.requestId === req.id && resolveResult.action === "reject" ? (
                          <div className="flex items-center gap-2 rounded-[1rem] border border-emerald-300/60 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                            Permintaan berhasil ditolak.
                          </div>
                        ) : null}

                        {req.status === "pending" && resolveResult?.requestId !== req.id ? (
                          resolveState?.requestId === req.id ? (
                            <div className="space-y-3 rounded-[1rem] border border-border bg-muted/35 p-3">
                              <p className="text-sm font-semibold text-foreground">
                                {resolveState.action === "approve"
                                  ? "Setujui permintaan ini?"
                                  : "Tolak permintaan ini?"}
                              </p>
                              <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-muted-foreground">
                                  Catatan (opsional)
                                </label>
                                <Input
                                  value={resolveNote}
                                  onChange={(event) => setResolveNote(event.target.value)}
                                  placeholder="Alasan atau catatan untuk user..."
                                  className="h-10 text-sm"
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant={resolveState.action === "approve" ? "default" : "destructive"}
                                  disabled={isResolving}
                                  onClick={() => void handleResolveRequest(req.id, resolveState.action)}
                                >
                                  {isResolving ? (
                                    <LoaderCircle className="h-4 w-4 animate-spin" />
                                  ) : resolveState.action === "approve" ? (
                                    <CheckCircle2 className="h-4 w-4" />
                                  ) : (
                                    <XCircle className="h-4 w-4" />
                                  )}
                                  {isResolving
                                    ? "Memproses..."
                                    : resolveState.action === "approve"
                                    ? "Ya, Setujui"
                                    : "Ya, Tolak"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={isResolving}
                                  onClick={() => {
                                    setResolveState(null);
                                    setResolveNote("");
                                  }}
                                >
                                  Batal
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => setResolveState({ requestId: req.id, action: "approve" })}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                Setujui
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setResolveState({ requestId: req.id, action: "reject" })}
                              >
                                <XCircle className="h-4 w-4" />
                                Tolak
                              </Button>
                            </div>
                          )
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}

                {resetError ? (
                  <div className="rounded-2xl border border-rose-300/60 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-200">
                    {resetError}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}
      </Tabs>
      </div>
    </div>
  );
}

function ManagedUserEditor({
  user,
  onSave,
}: {
  user: UserPersona;
  onSave: (
    userId: string,
    payload: {
      username: string;
      password?: string;
      email: string;
      whatsappNumber: string;
      name: string;
      nip: string;
      positionId: string;
      isActive?: boolean;
      profilePhotoUrl?: string;
    }
  ) => Promise<{ ok: boolean; message: string }>;
}) {
  const [form, setForm] = useState({
    username: user.username,
    password: "",
    email: user.email,
    whatsappNumber: user.whatsappNumber,
    name: user.name,
    nip: user.nip,
    positionId: user.positionId,
    isActive: user.isActive,
    profilePhotoUrl: user.profilePhotoUrl,
  });
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const rolePreview = getRoleLabel(getDefaultRoleForPosition(form.positionId));

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[0.52fr_1.48fr]">
        <Card className="border-border/80 bg-muted/30">
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-col items-center gap-3 text-center">
              <UserAvatar
                name={form.name}
                profilePhotoUrl={form.profilePhotoUrl}
                className="h-24 w-24 rounded-[1.8rem]"
                textClassName="text-lg"
              />
              <div className="space-y-1">
                <p className="text-lg font-semibold text-foreground">{form.name || "Nama akun"}</p>
                <p className="text-sm text-muted-foreground">{rolePreview}</p>
                <Badge variant="outline">{positions.find((position) => position.id === form.positionId)?.name ?? "-"}</Badge>
                <Badge variant={form.isActive ? "success" : "danger"}>
                  {form.isActive ? "Aktif" : "Diblokir"}
                </Badge>
              </div>
            </div>
            <PhotoInput
              value={form.profilePhotoUrl}
              onChange={(profilePhotoUrl) => {
                setSaved(false);
                setFormError("");
                setForm((current) => ({ ...current, profilePhotoUrl }));
              }}
            />
          </CardContent>
        </Card>

        <div className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <FieldBlock label="Nama Lengkap" required>
              <Input
                value={form.name}
                onChange={(event) => {
                  setSaved(false);
                  setFormError("");
                  setForm((current) => ({ ...current, name: event.target.value }));
                }}
                className="h-12 text-base"
              />
            </FieldBlock>
            <FieldBlock label="Username" required>
              <Input
                value={form.username}
                onChange={(event) => {
                  setSaved(false);
                  setFormError("");
                  setForm((current) => ({ ...current, username: event.target.value }));
                }}
                className="h-12 text-base"
              />
            </FieldBlock>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <FieldBlock label="Password Baru">
              <Input
                type="password"
                value={form.password}
                onChange={(event) => {
                  setSaved(false);
                  setFormError("");
                  setForm((current) => ({ ...current, password: event.target.value }));
                }}
                className="h-12 text-base"
                placeholder="Kosongkan jika password tidak diubah"
              />
            </FieldBlock>
            <FieldBlock label="Email" required>
              <Input
                value={form.email}
                onChange={(event) => {
                  setSaved(false);
                  setFormError("");
                  setForm((current) => ({ ...current, email: event.target.value }));
                }}
                className="h-12 text-base"
                placeholder="nama@pa.go.id"
              />
            </FieldBlock>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <FieldBlock label="Nomor WhatsApp" required>
              <Input
                value={form.whatsappNumber}
                onChange={(event) => {
                  setSaved(false);
                  setFormError("");
                  setForm((current) => ({ ...current, whatsappNumber: event.target.value }));
                }}
                className="h-12 text-base"
                placeholder="62812xxxxxxx"
              />
            </FieldBlock>
            <FieldBlock label="NIP" required>
              <Input
                value={form.nip}
                onChange={(event) => {
                  setSaved(false);
                  setFormError("");
                  setForm((current) => ({ ...current, nip: event.target.value }));
                }}
                className="h-12 text-base"
              />
            </FieldBlock>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <FieldBlock label="Jabatan" required>
              <NativeSelect
                value={form.positionId}
                onChange={(event) => {
                  setSaved(false);
                  setFormError("");
                  setForm((current) => ({ ...current, positionId: event.target.value }));
                }}
                className="h-12 text-base"
              >
                {positions.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.name} - {position.unitKerja}
                  </option>
                ))}
              </NativeSelect>
            </FieldBlock>
            <div className="rounded-[1.2rem] border border-border bg-muted/35 p-4">
              <div className="flex items-center gap-3">
                <UserRound className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold text-foreground">Role Turunan Jabatan</p>
                  <p className="text-sm text-muted-foreground">{rolePreview}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[1.2rem] border border-border bg-muted/35 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="font-semibold text-foreground">Status Login</p>
                <p className="text-sm text-muted-foreground">
                  Matikan akses untuk memblokir user yang sudah tidak aktif agar tidak bisa masuk ke ALETA.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={form.isActive ? "success" : "danger"}>
                  {form.isActive ? "Aktif" : "Diblokir"}
                </Badge>
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(checked) => {
                    setSaved(false);
                    setFormError("");
                    setForm((current) => ({ ...current, isActive: checked }));
                  }}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-[1.2rem] border border-border bg-muted/35 p-4">
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold text-foreground">OTP Reset Password</p>
                  <p className="text-sm text-muted-foreground">Nomor WA ini dipakai untuk alur OTP reset password.</p>
                </div>
              </div>
            </div>
            <div className="rounded-[1.2rem] border border-border bg-muted/35 p-4">
              <div className="flex items-center gap-3">
                <Camera className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold text-foreground">Foto Profil</p>
                  <p className="text-sm text-muted-foreground">Menggunakan upload native agar tetap ringan dan seamless.</p>
                </div>
              </div>
            </div>
          </div>

          {formError ? (
            <div className="rounded-[1.2rem] border border-rose-300/60 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-200">
              {formError}
            </div>
          ) : null}

          {saved ? (
            <div className="rounded-[1.2rem] border border-emerald-300/60 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
              Data akun berhasil diperbarui.
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] border border-dashed border-primary/30 bg-primary/5 p-4">
            <div className="space-y-1">
              <p className="font-semibold text-foreground">Hak akses mengikuti role dan jabatan definitif</p>
              <p className="text-sm text-muted-foreground">
                Perubahan jabatan akan memengaruhi target disposisi, visibilitas surat, dan rekomendasi kerja pada akun ini.
              </p>
            </div>
            <Button
              disabled={isSaving}
              onClick={async () => {
                if (
                  !form.name.trim() ||
                  !form.username.trim() ||
                  !form.email.trim() ||
                  !form.whatsappNumber.trim() ||
                  !form.nip.trim() ||
                  !form.positionId
                ) {
                  setSaved(false);
                  setFormError("Semua kolom wajib harus diisi terlebih dahulu.");
                  return;
                }

                setIsSaving(true);
                const result = await onSave(user.id, {
                  username: form.username.trim(),
                  password: form.password.trim() || undefined,
                  email: form.email.trim(),
                  whatsappNumber: form.whatsappNumber.trim(),
                  name: form.name.trim(),
                  nip: form.nip.trim(),
                  positionId: form.positionId,
                  isActive: form.isActive,
                  profilePhotoUrl: form.profilePhotoUrl,
                });
                setIsSaving(false);

                if (!result.ok) {
                  setSaved(false);
                  setFormError(result.message);
                  return;
                }

                setFormError("");
                setSaved(true);
                setForm((current) => ({ ...current, password: "" }));
              }}
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Menyimpan..." : "Simpan Akun"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

function ManagedUserFactory({
  onCreate,
}: {
  onCreate: (payload: {
    username: string;
    password: string;
    email: string;
    whatsappNumber: string;
    name: string;
    nip: string;
    positionId: string;
    isActive?: boolean;
    profilePhotoUrl?: string;
  }) => Promise<{ ok: boolean; message: string }>;
}) {
  const { users } = usePortal();
  const [form, setForm] = useState({
    username: "",
    password: "",
    email: "",
    whatsappNumber: "",
    name: "",
    nip: "",
    positionId: positions[0]?.id ?? "",
    isActive: true,
    profilePhotoUrl: undefined as string | undefined,
  });
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const rolePreview = getRoleLabel(getDefaultRoleForPosition(form.positionId));

  return (
    <div className="space-y-5">
      <div className="grid gap-6 lg:grid-cols-[0.5fr_1.5fr]">
        <Card className="border-border/80 bg-muted/30">
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-col items-center gap-3 text-center">
              <UserAvatar
                name={form.name || "Akun Baru"}
                profilePhotoUrl={form.profilePhotoUrl}
                className="h-24 w-24 rounded-[1.8rem]"
                textClassName="text-lg"
              />
              <div className="space-y-1">
                <p className="text-lg font-semibold text-foreground">{form.name || "Nama Lengkap"}</p>
                <p className="text-sm text-muted-foreground">{rolePreview}</p>
                <Badge variant="outline">{positions.find((position) => position.id === form.positionId)?.name ?? "-"}</Badge>
                <Badge variant={form.isActive ? "success" : "danger"}>{form.isActive ? "Aktif" : "Diblokir"}</Badge>
              </div>
            </div>
            <PhotoInput
              value={form.profilePhotoUrl}
              onChange={(profilePhotoUrl) => {
                setSaved(false);
                setFormError("");
                setForm((current) => ({ ...current, profilePhotoUrl }));
              }}
            />
          </CardContent>
        </Card>

        <div className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <FieldBlock label="Nama Lengkap" required>
              <Input
                value={form.name}
                onChange={(event) => {
                  setSaved(false);
                  setFormError("");
                  setForm((current) => ({ ...current, name: event.target.value }));
                }}
                className="h-12 text-base"
              />
            </FieldBlock>
            <FieldBlock label="Username" required>
              <Input
                value={form.username}
                onChange={(event) => {
                  setSaved(false);
                  setFormError("");
                  setForm((current) => ({ ...current, username: event.target.value }));
                }}
                className="h-12 text-base"
              />
            </FieldBlock>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <FieldBlock label="Password" required>
              <Input
                type="password"
                value={form.password}
                onChange={(event) => {
                  setSaved(false);
                  setFormError("");
                  setForm((current) => ({ ...current, password: event.target.value }));
                }}
                className="h-12 text-base"
              />
            </FieldBlock>
            <FieldBlock label="Email" required>
              <Input
                value={form.email}
                onChange={(event) => {
                  setSaved(false);
                  setFormError("");
                  setForm((current) => ({ ...current, email: event.target.value }));
                }}
                className="h-12 text-base"
                placeholder="nama@pa.go.id"
              />
            </FieldBlock>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <FieldBlock label="Nomor WhatsApp" required>
              <Input
                value={form.whatsappNumber}
                onChange={(event) => {
                  setSaved(false);
                  setFormError("");
                  setForm((current) => ({ ...current, whatsappNumber: event.target.value }));
                }}
                className="h-12 text-base"
                placeholder="62812xxxxxxx"
              />
            </FieldBlock>
            <FieldBlock label="NIP" required>
              <Input
                value={form.nip}
                onChange={(event) => {
                  setSaved(false);
                  setFormError("");
                  setForm((current) => ({ ...current, nip: event.target.value }));
                }}
                className="h-12 text-base"
              />
            </FieldBlock>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <FieldBlock label="Jabatan" required>
              <NativeSelect
                value={form.positionId}
                onChange={(event) => {
                  setSaved(false);
                  setFormError("");
                  setForm((current) => ({ ...current, positionId: event.target.value }));
                }}
                className="h-12 text-base"
              >
                {positions.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.name} - {position.unitKerja}
                  </option>
                ))}
              </NativeSelect>
            </FieldBlock>
            <div className="rounded-[1.2rem] border border-border bg-muted/35 p-4">
              <div className="flex items-center gap-3">
                <UserPlus className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold text-foreground">Role hasil mapping</p>
                  <p className="text-sm text-muted-foreground">{rolePreview}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[1.2rem] border border-border bg-muted/35 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="font-semibold text-foreground">Status Login Awal</p>
                <p className="text-sm text-muted-foreground">
                  Akun baru bisa langsung diblokir bila hanya ingin disiapkan lebih dulu tanpa boleh login.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={form.isActive ? "success" : "danger"}>
                  {form.isActive ? "Aktif" : "Diblokir"}
                </Badge>
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(checked) => {
                    setSaved(false);
                    setFormError("");
                    setForm((current) => ({ ...current, isActive: checked }));
                  }}
                />
              </div>
            </div>
          </div>

          {formError ? (
            <div className="rounded-[1.2rem] border border-rose-300/60 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-200">
              {formError}
            </div>
          ) : null}

          {saved ? (
            <div className="rounded-[1.2rem] border border-emerald-300/60 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
              Akun baru berhasil dibuat.
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] border border-dashed border-primary/30 bg-primary/5 p-4">
            <div className="space-y-1">
              <p className="font-semibold text-foreground">Pembuatan akun terpusat</p>
              <p className="text-sm text-muted-foreground">
                Akun baru langsung ikut state ALETA yang sama, sehingga siap dipakai login, disposisi, dan OTP WhatsApp.
              </p>
            </div>
            <Button
              disabled={isSaving}
              onClick={async () => {
                if (
                  !form.name.trim() ||
                  !form.username.trim() ||
                  !form.password.trim() ||
                  !form.email.trim() ||
                  !form.whatsappNumber.trim() ||
                  !form.nip.trim() ||
                  !form.positionId
                ) {
                  setSaved(false);
                  setFormError("Semua kolom wajib harus diisi terlebih dahulu.");
                  return;
                }

                if (users.some((user) => user.username.toLowerCase() === form.username.trim().toLowerCase())) {
                  setSaved(false);
                  setFormError("Username sudah digunakan. Pilih username lain.");
                  return;
                }

                setIsSaving(true);
                const result = await onCreate({
                  username: form.username.trim(),
                  password: form.password.trim(),
                  email: form.email.trim(),
                  whatsappNumber: form.whatsappNumber.trim(),
                  name: form.name.trim(),
                  nip: form.nip.trim(),
                  positionId: form.positionId,
                  isActive: form.isActive,
                  profilePhotoUrl: form.profilePhotoUrl,
                });
                setIsSaving(false);

                if (!result.ok) {
                  setSaved(false);
                  setFormError(result.message);
                  return;
                }

                setSaved(true);
                setFormError("");
                setForm({
                  username: "",
                  password: "",
                  email: "",
                  whatsappNumber: "",
                  name: "",
                  nip: "",
                  positionId: positions[0]?.id ?? "",
                  isActive: true,
                  profilePhotoUrl: undefined,
                });
              }}
            >
              <UserPlus className="h-4 w-4" />
              {isSaving ? "Menyimpan..." : "Buat Akun"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RoleVisibilityPanel({
  visibility,
  onToggle,
}: {
  visibility: ModuleVisibility[];
  onToggle: (roleId: ModuleVisibility["roleId"], moduleId: keyof ModuleVisibility["modules"], enabled: boolean) => void;
}) {
  return (
    <Tabs defaultValue={visibility[0]?.roleId}>
      <TabsList className="flex flex-wrap">
        {visibility.map((item) => (
          <TabsTrigger key={item.roleId} value={item.roleId}>
            {roles.find((role) => role.id === item.roleId)?.name ?? item.roleId}
          </TabsTrigger>
        ))}
      </TabsList>

      {visibility.map((item) => (
        <TabsContent key={item.roleId} value={item.roleId}>
          <Card className="border-border/80">
            <CardHeader>
              <CardTitle>Visibility untuk {roles.find((role) => role.id === item.roleId)?.name ?? item.roleId}</CardTitle>
              <CardDescription>Perubahan di sini langsung memengaruhi sidebar dan dashboard persona yang bersangkutan.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              {modules.map((module) => (
                <label
                  key={module.id}
                  className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-muted/35 p-4"
                >
                  <span className="space-y-1">
                    <span className="block font-semibold text-foreground">{module.label}</span>
                    <span className="block text-sm text-muted-foreground">{module.description}</span>
                  </span>
                  <Switch
                    checked={item.modules[module.id]}
                    onCheckedChange={(checked) => onToggle(item.roleId, module.id, checked)}
                  />
                </label>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      ))}
    </Tabs>
  );
}

function PhotoInput({
  value,
  onChange,
}: {
  value?: string;
  onChange: (value?: string) => void;
}) {
  const [photoError, setPhotoError] = useState("");

  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-foreground">
        Foto Profil
      </span>
      <Input
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          if (file.size > 1024 * 1024) {
            setPhotoError("Ukuran foto maksimal 1 MB agar aplikasi tetap ringan.");
            return;
          }

          const reader = new FileReader();
          reader.onload = () => {
            setPhotoError("");
            onChange(typeof reader.result === "string" ? reader.result : value);
          };
          reader.readAsDataURL(file);
        }}
      />
      {photoError ? <p className="mt-2 text-sm text-rose-600 dark:text-rose-300">{photoError}</p> : null}
    </label>
  );
}

function FieldBlock({
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
