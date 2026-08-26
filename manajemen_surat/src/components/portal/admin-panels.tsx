"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpDown, Camera, CheckCircle2, Eye, EyeOff, KeyRound, LoaderCircle, Save, Shield, ShieldAlert, ShieldCheck, Smartphone, UserPlus, UserRound, XCircle } from "lucide-react";

import { UserAvatar } from "@/components/portal/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreatableMultiSelect } from "@/components/ui/creatable-multi-select";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePortal } from "@/lib/app-state";
import { apiPath } from "@/lib/base-path";
import { modules, portalApps } from "@/lib/mock-data";
import { getDefaultRoleForPosition, getEffectiveRoleId, getRoleLabel, getUserPositionLabel, getUserRoleBadge, isPrivilegedAdmin } from "@/lib/permissions";
import { USER_ADDITIONAL_ROLE_OPTIONS, getAdditionalRoleLabel, getAdditionalRoleSearchText, normalizeAdditionalRoleIds } from "@/lib/user-additional-roles";
import { cn } from "@/lib/utils";
import { type ExternalAppCredentialInput, type ExternalAppId, type ModuleId, type ModuleVisibility, type Position, type RoleId, type UserPersona } from "@/lib/types";

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

type AdminLevel = "super-admin" | "admin" | "none";
type PrimaryRoleMode = "auto" | "pppk" | "pejabat-negara";
type ExternalCredentialDraft = {
  appId: ExternalAppId;
  label: string;
  username: string;
  password: string;
  isEnabled: boolean;
  hasPassword: boolean;
};

const PPPK_POSITION_ID = "pos-pppk";
const STATE_OFFICIAL_POSITION_IDS = new Set(["pos-ketua", "pos-wakil", "pos-hakim"]);
const ACCOUNT_POSITION_PRIORITY = new Map<string, number>([
  ["pos-ketua", 0],
  ["pos-wakil", 1],
  ["pos-hakim", 2],
  ["pos-panitera", 3],
  ["pos-sekretaris", 4],
  [PPPK_POSITION_ID, 5],
]);

function buildAccountPositionOptions(positionSource: Position[]) {
  return [...positionSource].sort((left, right) => {
    const leftPriority = ACCOUNT_POSITION_PRIORITY.get(left.id);
    const rightPriority = ACCOUNT_POSITION_PRIORITY.get(right.id);
    if (leftPriority !== undefined || rightPriority !== undefined) {
      return (leftPriority ?? 999) - (rightPriority ?? 999);
    }
    if (left.levelHierarchy !== right.levelHierarchy) {
      return left.levelHierarchy - right.levelHierarchy;
    }
    if (left.unitKerja !== right.unitKerja) {
      return left.unitKerja.localeCompare(right.unitKerja);
    }
    return left.name.localeCompare(right.name);
  });
}

function getDefaultAccountPositionId(accountPositionOptions: Position[]) {
  return accountPositionOptions.some((position) => position.id === "pos-staf-umum")
    ? "pos-staf-umum"
    : accountPositionOptions.find((position) => position.id !== PPPK_POSITION_ID)?.id ?? accountPositionOptions[0]?.id ?? "";
}

const EXTERNAL_CREDENTIAL_OPTIONS: Array<{ appId: ExternalAppId; label: string }> = [
  { appId: "sipp", label: "Akun SIPP" },
];
const moduleIds = new Set<ModuleId>(modules.map((module) => module.id));
const portalVisibilityApps = portalApps.filter((app) => !moduleIds.has(app.id));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toAdminLevel(roleId: RoleId): AdminLevel {
  if (roleId === "super-admin") return "super-admin";
  if (roleId === "admin") return "admin";
  return "none";
}

function toRoleOverride(level: AdminLevel): RoleId | null {
  if (level === "super-admin") return "super-admin";
  if (level === "admin") return "admin";
  return null;
}

function primaryRoleModeForUser(user: UserPersona): PrimaryRoleMode {
  if (user.roleId === "pppk" || user.positionId === PPPK_POSITION_ID) return "pppk";
  if (STATE_OFFICIAL_POSITION_IDS.has(user.positionId)) return "pejabat-negara";
  return "auto";
}

function getEffectiveRoleLabelForForm(adminLevel: AdminLevel, _primaryRoleMode: PrimaryRoleMode, positionId: string) {
  if (adminLevel === "super-admin") return "Super Admin";
  if (adminLevel === "admin") return "Admin";
  return getRoleLabel(getDefaultRoleForPosition(positionId));
}

function getAccountPositionForUser(user: UserPersona, accountPositionOptions: Position[]) {
  if (user.roleId === "pppk") return PPPK_POSITION_ID;
  return accountPositionOptions.some((position) => position.id === user.positionId)
    ? user.positionId
    : getDefaultAccountPositionId(accountPositionOptions);
}

function getPrimaryRoleModeForPosition(positionId: string): PrimaryRoleMode {
  if (positionId === PPPK_POSITION_ID) return "pppk";
  if (STATE_OFFICIAL_POSITION_IDS.has(positionId)) return "pejabat-negara";
  return "auto";
}

function getNormalAccountPositionId(currentPositionId: string, accountPositionOptions: Position[]) {
  if (currentPositionId && currentPositionId !== PPPK_POSITION_ID && !STATE_OFFICIAL_POSITION_IDS.has(currentPositionId)) {
    return currentPositionId;
  }
  return getDefaultAccountPositionId(accountPositionOptions);
}

function getPositionLabel(positionId: string, accountPositionOptions: Position[]) {
  const position = accountPositionOptions.find((item) => item.id === positionId);
  return position ? position.name : "-";
}

function buildExternalCredentialDrafts(user?: Pick<UserPersona, "externalCredentials">): ExternalCredentialDraft[] {
  return EXTERNAL_CREDENTIAL_OPTIONS.map((option) => {
    const credential =
      user?.externalCredentials?.find((item) => item.appId === option.appId) ??
      (option.appId === "sipp"
        ? user?.externalCredentials?.find((item) => item.appId === "aps-badilag")
        : undefined);
    return {
      appId: option.appId,
      label: option.label,
      username: credential?.username ?? "",
      password: "",
      isEnabled: Boolean(credential?.isEnabled),
      hasPassword: Boolean(credential?.hasPassword),
    };
  });
}

function toExternalCredentialPayload(drafts: ExternalCredentialDraft[]): ExternalAppCredentialInput[] {
  return drafts.map((draft) => ({
    appId: draft.appId,
    username: draft.username.trim(),
    password: draft.password ? draft.password : undefined,
    isEnabled: draft.isEnabled,
  }));
}

function validateExternalCredentialDrafts(drafts: ExternalCredentialDraft[]) {
  const invalid = drafts.find((draft) => draft.isEnabled && (!draft.username.trim() || (!draft.password && !draft.hasPassword)));
  if (!invalid) return "";
  return `Username dan password ${invalid.label} wajib diisi sebelum login otomatis diaktifkan.`;
}

function sortManagedUsers(
  users: UserPersona[],
  sortKey: AccountSortKey,
  sortDir: "asc" | "desc",
  positionSource: Position[]
) {
  const sorted = [...users].sort((left, right) => {
    if (sortKey === "status") {
      if (left.isActive !== right.isActive) {
        return left.isActive ? -1 : 1;
      }
      return left.name.localeCompare(right.name);
    }
    if (sortKey === "position") {
      return getUserPositionLabel(left, positionSource).localeCompare(getUserPositionLabel(right, positionSource));
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

function hasValidWhatsappNumber(value: string | undefined) {
  return /^62\d{8,15}$/.test(normalizeWhatsappNumber(value));
}

function normalizeWhatsappNumber(value: string | undefined) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
}

function getUserAdditionalRoleLabels(user: Pick<UserPersona, "additionalRoleIds">) {
  return normalizeAdditionalRoleIds(user.additionalRoleIds).map(getAdditionalRoleLabel);
}

function AdditionalRolesPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <FieldBlock label="Jabatan/unit tambahan">
      <CreatableMultiSelect
        value={normalizeAdditionalRoleIds(value)}
        onChange={(next) => onChange(normalizeAdditionalRoleIds(next))}
        options={USER_ADDITIONAL_ROLE_OPTIONS.map((option) => ({
          value: option.id,
          label: `${option.label} - ${option.group}`,
        }))}
        placeholder="Pilih lebih dari satu tugas tambahan..."
        allowCreate
      />
      <p className="text-xs leading-5 text-muted-foreground">
        Dipakai untuk tugas operasional non-definitif seperti kasir, penjaga sidang, petugas akta cerai, PTSP, e-Court, SIPP, dan layanan lain. Untuk PPPK, isi penugasan/unit rinci di sini.
      </p>
    </FieldBlock>
  );
}

// ─── Admin Level Selector ─────────────────────────────────────────────────────

function ExternalCredentialsEditor({
  value,
  onChange,
}: {
  value: ExternalCredentialDraft[];
  onChange: (value: ExternalCredentialDraft[]) => void;
}) {
  const updateCredential = (appId: ExternalAppId, patch: Partial<ExternalCredentialDraft>) => {
    onChange(value.map((item) => (item.appId === appId ? { ...item, ...patch } : item)));
  };

  return (
    <div className="rounded-[1.2rem] border border-border bg-muted/35 p-4">
      <div className="mb-4 flex items-start gap-3">
        <KeyRound className="mt-0.5 h-5 w-5 text-primary" />
        <div className="space-y-1">
          <p className="font-semibold text-foreground">Login Otomatis SIPP dan APS Badilag</p>
          <p className="text-sm text-muted-foreground">
            Isi satu akun SIPP per pegawai. APS Badilag memakai username dan password dari database SIPP yang sama.
            Password disimpan terenkripsi di ALETA; fingerprint MD5 hanya dipakai untuk kompatibilitas SIPP lama.
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {value.map((credential) => (
          <div key={credential.appId} className="rounded-[1rem] border border-border/80 bg-background/45 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-foreground">{credential.label}</p>
                <p className="text-xs text-muted-foreground">
                  {credential.hasPassword ? "Password sudah tersimpan. Isi lagi hanya jika ingin mengganti." : "Belum ada password tersimpan."}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={credential.isEnabled ? "success" : "muted"}>
                  {credential.isEnabled ? "Aktif" : "Nonaktif"}
                </Badge>
                <Switch
                  checked={credential.isEnabled}
                  onCheckedChange={(checked) => updateCredential(credential.appId, { isEnabled: checked })}
                />
              </div>
            </div>

            <div className="grid gap-3">
              <FieldBlock label="Username">
                <Input
                  value={credential.username}
                  onChange={(event) => updateCredential(credential.appId, { username: event.target.value })}
                  className="h-11 text-base"
                  placeholder="Username SIPP"
                />
              </FieldBlock>
              <FieldBlock label="Password">
                <Input
                  type="password"
                  value={credential.password}
                  onChange={(event) => updateCredential(credential.appId, { password: event.target.value })}
                  className="h-11 text-base"
                  placeholder={credential.hasPassword ? "Kosongkan jika tidak diganti" : "Password SIPP"}
                />
              </FieldBlock>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        Saat user membuka kartu SIPP atau APS Badilag dari Portal ALETA, keduanya memakai kredensial SIPP ini. ALETA tidak mengubah tabel SIPP dan tidak menyimpan password ini dalam audit.
      </p>
    </div>
  );
}

function AdminLevelSelector({
  value,
  onChange,
  actorRoleId,
  targetRoleId,
}: {
  value: AdminLevel;
  onChange: (v: AdminLevel) => void;
  actorRoleId: RoleId;
  targetRoleId?: RoleId; // undefined = new user
}) {
  const isSuperAdminActor = actorRoleId === "super-admin";
  const isTargetSuperAdmin = targetRoleId === "super-admin";

  // Admin editing a super-admin → show warning, no edit
  if (!isSuperAdminActor && isTargetSuperAdmin) {
    return (
      <div className="rounded-[1.2rem] border border-amber-300/60 bg-amber-50/80 p-4 dark:bg-amber-950/20">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              Akun Super Admin
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Akun Super Admin hanya dapat diubah oleh Super Admin.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const options: { value: AdminLevel; label: string; desc: string; icon: React.ReactNode }[] = [
    {
      value: "none",
      label: "Bukan Admin",
    desc: "Akses sesuai jabatan dan peran utama.",
      icon: <UserRound className="h-4 w-4" />,
    },
    {
      value: "admin",
      label: "Admin",
      desc: "Dapat mengelola fitur administrasi tertentu.",
      icon: <Shield className="h-4 w-4" />,
    },
    ...(isSuperAdminActor
      ? [
          {
            value: "super-admin" as AdminLevel,
            label: "Super Admin",
            desc: "Akses penuh ke seluruh pengaturan sistem.",
            icon: <ShieldCheck className="h-4 w-4" />,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-3">
      <div className={cn("grid gap-2", isSuperAdminActor ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-[1.2rem] border p-3 text-left transition",
              value === opt.value
                ? opt.value === "super-admin"
                  ? "border-violet-400/60 bg-violet-50 dark:border-violet-500/40 dark:bg-violet-950/30"
                  : opt.value === "admin"
                  ? "border-primary/40 bg-primary/10"
                  : "border-border bg-card ring-1 ring-border"
                : "border-border bg-muted/20 hover:bg-muted/40"
            )}
          >
            <div
              className={cn(
                "mb-1 flex items-center gap-1.5 font-semibold",
                value === opt.value && opt.value === "super-admin"
                  ? "text-violet-700 dark:text-violet-300"
                  : value === opt.value && opt.value === "admin"
                  ? "text-primary"
                  : "text-foreground"
              )}
            >
              {opt.icon}
              {opt.label}
            </div>
            <p className="text-xs text-muted-foreground">{opt.desc}</p>
          </button>
        ))}
      </div>

      {value === "super-admin" ? (
        <div className="flex items-start gap-2 rounded-[1rem] border border-amber-300/60 bg-amber-50/80 px-4 py-3 text-sm text-amber-700 dark:bg-amber-950/20 dark:text-amber-300">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          Super Admin memiliki akses penuh ke pengaturan sistem. Berikan hanya kepada pengguna yang benar-benar berwenang.
        </div>
      ) : null}
    </div>
  );
}

// ─── User Role Badge (in user list) ──────────────────────────────────────────

function UserRoleBadgeDisplay({ user }: { user: UserPersona }) {
  if (user.roleId === "super-admin") {
    return (
      <Badge className="border-violet-400/60 bg-violet-50 text-violet-700 dark:border-violet-500/40 dark:bg-violet-950/40 dark:text-violet-300">
        Super Admin
      </Badge>
    );
  }
  if (user.roleId === "admin") {
    return <Badge variant="default">Admin</Badge>;
  }
  return <Badge variant="outline">{getUserRoleBadge(user)}</Badge>;
}

// ─── Mapping Board ────────────────────────────────────────────────────────────

export function MappingBoard({ missingWhatsappOnly = false }: { missingWhatsappOnly?: boolean }) {
  const { createManagedUser, currentUser, positions, updateManagedUser, users } = usePortal();
  const isAdmin = isPrivilegedAdmin(currentUser);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<AccountSortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const actorRoleId = getEffectiveRoleId(currentUser) ?? "staf";
  const isSuperAdmin = actorRoleId === "super-admin";

  const filteredUsers = useMemo(() => {
    const visibleUsers = isSuperAdmin
      ? users
      : users.filter((user) => user.roleId !== "super-admin");

    const scopedUsers = missingWhatsappOnly
      ? visibleUsers.filter((user) => user.isActive && !hasValidWhatsappNumber(user.whatsappNumber))
      : visibleUsers;

    const searchedUsers = scopedUsers.filter((user) =>
      [user.name, user.username, user.email, user.nip, user.whatsappNumber, getAdditionalRoleSearchText(user.additionalRoleIds ?? [])]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase())
    );

    return sortManagedUsers(searchedUsers, sortKey, sortDir, positions);
  }, [isSuperAdmin, missingWhatsappOnly, positions, query, sortDir, sortKey, users]);
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
      const response = await fetch(apiPath("/api/users/recovery/admin-requests"), { credentials: "include" });
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
    if (!isAdmin || !requestsTab) return;

    const timer = globalThis.setTimeout(() => {
      void loadResetRequests();
    }, 0);

    return () => globalThis.clearTimeout(timer);
  }, [isAdmin, requestsTab]);

  const handleAdminReset = async (targetUserId: string) => {
    setIsResettingUserId(targetUserId);
    setResetResult(null);
    setResetError("");
    try {
      const response = await fetch(apiPath(`/api/users/${targetUserId}/reset-password`), {
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
      const response = await fetch(apiPath(`/api/users/recovery/admin-requests/${requestId}`), {
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
    <div className="grid gap-6 xl:grid-cols-[minmax(280px,0.3fr)_minmax(0,0.7fr)] xl:items-start">
      <Card className="border-border/80 xl:sticky xl:top-4">

        <CardHeader>
          <CardTitle>Daftar Akun</CardTitle>
          <CardDescription>Pilih akun untuk diperbarui atau gunakan tab akun baru untuk menambah pengguna.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {missingWhatsappOnly ? (
            <div className="rounded-2xl border border-amber-300/70 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Badge variant="warning">Filter: Belum punya nomor WhatsApp</Badge>
                  <p className="mt-2 font-semibold">{filteredUsers.length} pegawai aktif belum memiliki nomor WhatsApp.</p>
                  <p className="mt-1 text-xs leading-5 text-amber-800 dark:text-amber-200">
                    Lengkapi nomor WhatsApp pegawai prioritas sebelum pilot WhatsApp agar ALETA Bot tidak memakai data lama.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => { window.location.assign(apiPath("/admin/mapping-user-jabatan")); }}>
                  Hapus Filter
                </Button>
              </div>
            </div>
          ) : null}
          <div className="grid gap-3 2xl:grid-cols-[minmax(0,1fr)_160px]">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari akun..."
              className="h-11 text-sm"
            />
            <div className="flex items-center gap-2 rounded-[1.1rem] border border-border bg-muted/35 px-3">
              <ArrowUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              <NativeSelect
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value as AccountSortKey)}
                className="h-11 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
              >
                <option value="name">Nama</option>
                <option value="username">Username</option>
                <option value="position">Jabatan</option>
                <option value="role">Peran</option>
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
                (isSuperAdmin || user.roleId !== "super-admin") &&
                currentUser?.id !== user.id;
              const additionalRoleLabels = getUserAdditionalRoleLabels(user);
              return (
                <div key={user.id} className="space-y-1">
                  <button
                    type="button"
                    className={`w-full rounded-[1.2rem] border px-3 py-3 text-left transition ${
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
                          className="h-10 w-10 rounded-2xl"
                          textClassName="text-xs"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{user.name}</p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{user.username}</p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{user.email || "Data email dilindungi"}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <UserRoleBadgeDisplay user={user} />
                        {!user.isActive ? <Badge variant="danger">Diblokir</Badge> : null}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {user.nip?.trim() ? <span>NIP {user.nip}</span> : <span>Tanpa NIP</span>}
                      <span>-</span>
                      <span>{getUserPositionLabel(user, positions)}</span>
                    </div>
                    {additionalRoleLabels.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {additionalRoleLabels.slice(0, 4).map((label) => (
                          <Badge key={label} variant="outline" className="text-[10px]">{label}</Badge>
                        ))}
                        {additionalRoleLabels.length > 4 ? <Badge variant="muted" className="text-[10px]">+{additionalRoleLabels.length - 4}</Badge> : null}
                      </div>
                    ) : null}
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
                      <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">Password sementara tampil sekali. Simpan sebelum ditutup.</p>
                      <p className="mt-1 font-mono text-base font-bold tracking-widest text-amber-900 dark:text-amber-100">{resetResult.tempPassword}</p>
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Sampaikan langsung kepada pengguna dan minta segera diganti.</p>
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
              <CardDescription>Tambah pengguna baru dengan data identitas lengkap dan foto profil.</CardDescription>
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
                    <CardDescription>Permintaan dari pengguna yang tidak bisa menggunakan OTP WhatsApp. Setujui untuk membuat password sementara.</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isLoadingRequests}
                    onClick={() => void loadResetRequests()}
                  >
                    {isLoadingRequests ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Perbarui"}
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
                            <p className="text-sm text-muted-foreground">{req.username} - NIP {req.nip}</p>
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
                              Password sementara tampil sekali. Simpan sebelum ditutup.
                            </p>
                            <p className="mt-1 font-mono text-base font-bold tracking-widest text-amber-900 dark:text-amber-100">
                              {resolveResult.tempPassword}
                            </p>
                            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                              Sampaikan langsung kepada pengguna dan minta segera diganti.
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
                    placeholder="Alasan atau catatan untuk pengguna..."
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

// ─── Managed User Editor ──────────────────────────────────────────────────────

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
      additionalRoleIds?: string[];
      isActive?: boolean;
      profilePhotoUrl?: string;
      roleOverride?: RoleId | null;
      externalCredentials?: ExternalAppCredentialInput[];
    }
  ) => Promise<{ ok: boolean; message: string }>;
}) {
  const { currentUser, positions } = usePortal();
  const actorRoleId = getEffectiveRoleId(currentUser) ?? ("staf" as RoleId);
  const isSuperAdminActor = actorRoleId === "super-admin";
  const isTargetSuperAdmin = user.roleId === "super-admin";
  // Admin can only toggle isActive for non-super-admin targets
  const canToggleActive = isSuperAdminActor || !isTargetSuperAdmin;
  const accountPositionOptions = useMemo(() => buildAccountPositionOptions(positions), [positions]);

  const [form, setForm] = useState({
    username: user.username,
    password: "",
    email: user.email,
    whatsappNumber: user.whatsappNumber,
    name: user.name,
    nip: user.nip,
    positionId: getAccountPositionForUser(user, accountPositionOptions),
    additionalRoleIds: user.additionalRoleIds ?? [],
    isActive: user.isActive,
    profilePhotoUrl: user.profilePhotoUrl,
    adminLevel: toAdminLevel(user.roleId),
    primaryRoleMode: primaryRoleModeForUser(user),
    externalCredentials: buildExternalCredentialDrafts(user),
  });
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const effectiveRoleLabel = getEffectiveRoleLabelForForm(form.adminLevel, form.primaryRoleMode, form.positionId);

  const resetForm = (key: string, value: unknown) => {
    setSaved(false);
    setFormError("");
    setForm((current) => ({ ...current, [key]: value }));
  };

  const resetPosition = (positionId: string) => {
    setSaved(false);
    setFormError("");
    setForm((current) => ({
      ...current,
      positionId,
      primaryRoleMode: getPrimaryRoleModeForPosition(positionId),
    }));
  };

  const resetPrimaryRoleMode = (primaryRoleMode: PrimaryRoleMode) => {
    setSaved(false);
    setFormError("");
    setForm((current) => ({
      ...current,
      primaryRoleMode,
      positionId: primaryRoleMode === "pppk"
        ? PPPK_POSITION_ID
        : primaryRoleMode === "pejabat-negara"
          ? STATE_OFFICIAL_POSITION_IDS.has(current.positionId)
            ? current.positionId
            : "pos-hakim"
          : getNormalAccountPositionId(current.positionId, accountPositionOptions),
    }));
  };

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[0.52fr_1.48fr]">
        <Card className="overflow-hidden border-border/80 bg-muted/30">
          <CardContent className="space-y-5 p-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <UserAvatar
                name={form.name}
                profilePhotoUrl={form.profilePhotoUrl}
                className="h-24 w-24 rounded-[1.8rem]"
                textClassName="text-lg"
              />
              <div className="space-y-1">
                <p className="text-lg font-semibold text-foreground">{form.name || "Nama akun"}</p>
                <p className="text-sm text-muted-foreground">{effectiveRoleLabel}</p>
                <Badge variant="outline">
                  {getPositionLabel(form.positionId, accountPositionOptions)}
                </Badge>
                {normalizeAdditionalRoleIds(form.additionalRoleIds).slice(0, 3).map((roleId) => (
                  <Badge key={roleId} variant="muted">{getAdditionalRoleLabel(roleId)}</Badge>
                ))}
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
                onChange={(event) => resetForm("name", event.target.value)}
                className="h-12 text-base"
              />
            </FieldBlock>
            <FieldBlock label="Username" required>
              <Input
                value={form.username}
                onChange={(event) => resetForm("username", event.target.value)}
                className="h-12 text-base"
              />
            </FieldBlock>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <FieldBlock label="Password Baru">
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(event) => resetForm("password", event.target.value)}
                  className="h-12 pr-12 text-base"
                  placeholder="Kosongkan jika password tidak diubah"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </FieldBlock>
            <FieldBlock label="Email" required>
              <Input
                value={form.email}
                onChange={(event) => resetForm("email", event.target.value)}
                className="h-12 text-base"
                placeholder="nama@pa.go.id"
              />
            </FieldBlock>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <FieldBlock label="Nomor WhatsApp" required>
              <Input
                value={form.whatsappNumber}
                onChange={(event) => resetForm("whatsappNumber", event.target.value)}
                className="h-12 text-base"
                placeholder="62812xxxxxxx"
              />
            </FieldBlock>
            <FieldBlock label="NIP" required>
              <Input
                value={form.nip}
                onChange={(event) => resetForm("nip", event.target.value)}
                className="h-12 text-base"
              />
            </FieldBlock>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <FieldBlock label="Jabatan" required>
              <NativeSelect
                value={form.positionId}
                onChange={(event) => resetPosition(event.target.value)}
                className="h-12 text-base"
              >
                {accountPositionOptions.map((position) => (
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
                  <p className="font-semibold text-foreground">Peran Efektif</p>
                  <p className="text-sm text-muted-foreground">{effectiveRoleLabel}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[1.2rem] border border-border bg-muted/35 p-4">
            <div className="grid gap-4 md:grid-cols-[0.72fr_1.28fr] md:items-center">
              <div className="space-y-1">
                <p className="font-semibold text-foreground">Status ASN/Jabatan</p>
                <p className="text-sm text-muted-foreground">
                  PPPK memakai Jabatan PPPK; Ketua, Wakil Ketua, dan Hakim otomatis terbaca sebagai Pejabat Negara.
                </p>
              </div>
              <NativeSelect
                value={form.primaryRoleMode}
                onChange={(event) => resetPrimaryRoleMode(event.target.value as PrimaryRoleMode)}
                disabled={form.adminLevel !== "none"}
                className="h-12 text-base"
              >
                <option value="auto">Otomatis dari jabatan</option>
                <option value="pppk">PPPK</option>
                <option value="pejabat-negara">Pejabat Negara</option>
              </NativeSelect>
            </div>
          </div>

          <AdditionalRolesPicker
            value={form.additionalRoleIds}
            onChange={(value) => resetForm("additionalRoleIds", value)}
          />

          <ExternalCredentialsEditor
            value={form.externalCredentials}
            onChange={(value) => resetForm("externalCredentials", value)}
          />

          {/* Admin Level Selector */}
          <div className="space-y-3 rounded-[1.2rem] border border-border bg-muted/35 p-4">
            <div className="space-y-1">
              <p className="font-semibold text-foreground">
                {isSuperAdminActor ? "Level Akses Admin" : "Hak Akses Admin"}
              </p>
              <p className="text-sm text-muted-foreground">
                Tentukan apakah akun ini memiliki hak admin di atas jabatannya.
              </p>
            </div>
            <AdminLevelSelector
              value={form.adminLevel}
              onChange={(v) => resetForm("adminLevel", v)}
              actorRoleId={actorRoleId}
              targetRoleId={user.roleId}
            />
          </div>

          {/* Status Login / Block toggle */}
          {canToggleActive ? (
            <div className="rounded-[1.2rem] border border-border bg-muted/35 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">Status Login</p>
                  <p className="text-sm text-muted-foreground">
                  Matikan akses untuk memblokir pengguna yang sudah tidak aktif agar tidak bisa masuk ke ALETA.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={form.isActive ? "success" : "danger"}>
                    {form.isActive ? "Aktif" : "Diblokir"}
                  </Badge>
                  <Switch
                    checked={form.isActive}
                    onCheckedChange={(checked) => resetForm("isActive", checked)}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-[1.2rem] border border-amber-300/60 bg-amber-50/80 p-4 dark:bg-amber-950/20">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Status akun Super Admin hanya dapat diubah oleh Super Admin.
                </p>
              </div>
            </div>
          )}

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
                  <p className="text-sm text-muted-foreground">Upload dibuat ringan agar mudah dipakai.</p>
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
              Akun berhasil diperbarui.
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] border border-dashed border-primary/30 bg-primary/5 p-4">
            <div className="space-y-1">
              <p className="font-semibold text-foreground">Hak akses mengikuti peran dan jabatan definitif</p>
              <p className="text-sm text-muted-foreground">
                Perubahan jabatan akan memengaruhi target disposisi, akses surat, dan rekomendasi kerja pada akun ini.
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

                const whatsappNumber = normalizeWhatsappNumber(form.whatsappNumber);
                if (!hasValidWhatsappNumber(whatsappNumber)) {
                  setSaved(false);
                  setFormError("Nomor WhatsApp harus memakai format Indonesia yang valid, contoh 628123456789.");
                  return;
                }

                const externalCredentialError = validateExternalCredentialDrafts(form.externalCredentials);
                if (externalCredentialError) {
                  setSaved(false);
                  setFormError(externalCredentialError);
                  return;
                }

                setIsSaving(true);
                const result = await onSave(user.id, {
                  username: form.username.trim(),
                  password: form.password.trim() || undefined,
                  email: form.email.trim(),
                  whatsappNumber,
                  name: form.name.trim(),
                  nip: form.nip.trim(),
                  positionId: form.positionId,
                  additionalRoleIds: normalizeAdditionalRoleIds(form.additionalRoleIds),
                  isActive: canToggleActive ? form.isActive : undefined,
                  profilePhotoUrl: form.profilePhotoUrl,
                  roleOverride: isTargetSuperAdmin && !isSuperAdminActor
                    ? undefined // Admin can't change super-admin's role; don't send
                    : toRoleOverride(form.adminLevel),
                  externalCredentials: toExternalCredentialPayload(form.externalCredentials),
                });
                setIsSaving(false);

                if (!result.ok) {
                  setSaved(false);
                  setFormError(result.message);
                  return;
                }

                setFormError("");
                setSaved(true);
                setForm((current) => ({ ...current, whatsappNumber, password: "" }));
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

// ─── Managed User Factory ─────────────────────────────────────────────────────

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
    additionalRoleIds?: string[];
    isActive?: boolean;
    profilePhotoUrl?: string;
    roleOverride: RoleId | null;
    externalCredentials?: ExternalAppCredentialInput[];
  }) => Promise<{ ok: boolean; message: string }>;
}) {
  const { currentUser, positions, users } = usePortal();
  const actorRoleId = getEffectiveRoleId(currentUser) ?? ("staf" as RoleId);
  const isSuperAdminActor = actorRoleId === "super-admin";
  const accountPositionOptions = useMemo(() => buildAccountPositionOptions(positions), [positions]);
  const defaultAccountPositionId = getDefaultAccountPositionId(accountPositionOptions);

  const [form, setForm] = useState({
    username: "",
    password: "",
    email: "",
    whatsappNumber: "",
    name: "",
    nip: "",
    positionId: defaultAccountPositionId,
    additionalRoleIds: [] as string[],
    isActive: true,
    profilePhotoUrl: undefined as string | undefined,
    adminLevel: "none" as AdminLevel,
    primaryRoleMode: "auto" as PrimaryRoleMode,
    externalCredentials: buildExternalCredentialDrafts(),
  });
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const effectiveRoleLabel = getEffectiveRoleLabelForForm(form.adminLevel, form.primaryRoleMode, form.positionId);

  const resetForm = (key: string, value: unknown) => {
    setSaved(false);
    setFormError("");
    setForm((current) => ({ ...current, [key]: value }));
  };

  const resetPosition = (positionId: string) => {
    setSaved(false);
    setFormError("");
    setForm((current) => ({
      ...current,
      positionId,
      primaryRoleMode: getPrimaryRoleModeForPosition(positionId),
    }));
  };

  const resetPrimaryRoleMode = (primaryRoleMode: PrimaryRoleMode) => {
    setSaved(false);
    setFormError("");
    setForm((current) => ({
      ...current,
      primaryRoleMode,
      positionId: primaryRoleMode === "pppk"
        ? PPPK_POSITION_ID
        : primaryRoleMode === "pejabat-negara"
          ? STATE_OFFICIAL_POSITION_IDS.has(current.positionId)
            ? current.positionId
            : "pos-hakim"
          : getNormalAccountPositionId(current.positionId, accountPositionOptions),
    }));
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-6 lg:grid-cols-[0.5fr_1.5fr]">
        <Card className="overflow-hidden border-border/80 bg-muted/30">
          <CardContent className="space-y-5 p-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <UserAvatar
                name={form.name || "Akun Baru"}
                profilePhotoUrl={form.profilePhotoUrl}
                className="h-24 w-24 rounded-[1.8rem]"
                textClassName="text-lg"
              />
              <div className="space-y-1">
                <p className="text-lg font-semibold text-foreground">{form.name || "Nama Lengkap"}</p>
                <p className="text-sm text-muted-foreground">{effectiveRoleLabel}</p>
                <Badge variant="outline">
                  {getPositionLabel(form.positionId, accountPositionOptions)}
                </Badge>
                {normalizeAdditionalRoleIds(form.additionalRoleIds).slice(0, 3).map((roleId) => (
                  <Badge key={roleId} variant="muted">{getAdditionalRoleLabel(roleId)}</Badge>
                ))}
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
                onChange={(event) => resetForm("name", event.target.value)}
                className="h-12 text-base"
              />
            </FieldBlock>
            <FieldBlock label="Username" required>
              <Input
                value={form.username}
                onChange={(event) => resetForm("username", event.target.value)}
                className="h-12 text-base"
              />
            </FieldBlock>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <FieldBlock label="Password" required>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(event) => resetForm("password", event.target.value)}
                  className="h-12 pr-12 text-base"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </FieldBlock>
            <FieldBlock label="Email" required>
              <Input
                value={form.email}
                onChange={(event) => resetForm("email", event.target.value)}
                className="h-12 text-base"
                placeholder="nama@pa.go.id"
              />
            </FieldBlock>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <FieldBlock label="Nomor WhatsApp" required>
              <Input
                value={form.whatsappNumber}
                onChange={(event) => resetForm("whatsappNumber", event.target.value)}
                className="h-12 text-base"
                placeholder="62812xxxxxxx"
              />
            </FieldBlock>
            <FieldBlock label="NIP" required>
              <Input
                value={form.nip}
                onChange={(event) => resetForm("nip", event.target.value)}
                className="h-12 text-base"
              />
            </FieldBlock>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <FieldBlock label="Jabatan" required>
              <NativeSelect
                value={form.positionId}
                onChange={(event) => resetPosition(event.target.value)}
                className="h-12 text-base"
              >
                {accountPositionOptions.map((position) => (
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
                  <p className="font-semibold text-foreground">Peran hasil mapping</p>
                  <p className="text-sm text-muted-foreground">{effectiveRoleLabel}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[1.2rem] border border-border bg-muted/35 p-4">
            <div className="grid gap-4 md:grid-cols-[0.72fr_1.28fr] md:items-center">
              <div className="space-y-1">
                <p className="font-semibold text-foreground">Status ASN/Jabatan</p>
                <p className="text-sm text-muted-foreground">
                  PPPK memakai Jabatan PPPK; Ketua, Wakil Ketua, dan Hakim otomatis terbaca sebagai Pejabat Negara.
                </p>
              </div>
              <NativeSelect
                value={form.primaryRoleMode}
                onChange={(event) => resetPrimaryRoleMode(event.target.value as PrimaryRoleMode)}
                disabled={form.adminLevel !== "none"}
                className="h-12 text-base"
              >
                <option value="auto">Otomatis dari jabatan</option>
                <option value="pppk">PPPK</option>
                <option value="pejabat-negara">Pejabat Negara</option>
              </NativeSelect>
            </div>
          </div>

          <AdditionalRolesPicker
            value={form.additionalRoleIds}
            onChange={(value) => resetForm("additionalRoleIds", value)}
          />

          <ExternalCredentialsEditor
            value={form.externalCredentials}
            onChange={(value) => resetForm("externalCredentials", value)}
          />

          {/* Admin Level Selector */}
          <div className="space-y-3 rounded-[1.2rem] border border-border bg-muted/35 p-4">
            <div className="space-y-1">
              <p className="font-semibold text-foreground">
                {isSuperAdminActor ? "Level Akses Admin" : "Hak Akses Admin"}
              </p>
              <p className="text-sm text-muted-foreground">
                Pilih apakah akun baru ini diberikan hak admin di atas jabatannya.
              </p>
            </div>
            <AdminLevelSelector
              value={form.adminLevel}
              onChange={(v) => resetForm("adminLevel", v)}
              actorRoleId={actorRoleId}
              targetRoleId={undefined} // new user, no existing role
            />
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
                  onCheckedChange={(checked) => resetForm("isActive", checked)}
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

                const whatsappNumber = normalizeWhatsappNumber(form.whatsappNumber);
                if (!hasValidWhatsappNumber(whatsappNumber)) {
                  setSaved(false);
                  setFormError("Nomor WhatsApp harus memakai format Indonesia yang valid, contoh 628123456789.");
                  return;
                }

                if (users.some((user) => user.username.toLowerCase() === form.username.trim().toLowerCase())) {
                  setSaved(false);
                  setFormError("Username sudah digunakan. Pilih username lain.");
                  return;
                }

                const externalCredentialError = validateExternalCredentialDrafts(form.externalCredentials);
                if (externalCredentialError) {
                  setSaved(false);
                  setFormError(externalCredentialError);
                  return;
                }

                setIsSaving(true);
                const result = await onCreate({
                  username: form.username.trim(),
                  password: form.password.trim(),
                  email: form.email.trim(),
                  whatsappNumber,
                  name: form.name.trim(),
                  nip: form.nip.trim(),
                  positionId: form.positionId,
                  additionalRoleIds: normalizeAdditionalRoleIds(form.additionalRoleIds),
                  isActive: form.isActive,
                  profilePhotoUrl: form.profilePhotoUrl,
                  roleOverride: toRoleOverride(form.adminLevel),
                  externalCredentials: toExternalCredentialPayload(form.externalCredentials),
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
                  positionId: defaultAccountPositionId,
                  additionalRoleIds: [],
                  isActive: true,
                  profilePhotoUrl: undefined,
                  adminLevel: "none",
                  primaryRoleMode: "auto",
                  externalCredentials: buildExternalCredentialDrafts(),
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

// ─── Role Visibility Panel ────────────────────────────────────────────────────

export function RoleVisibilityPanel({
  visibility,
  onToggle,
}: {
  visibility: ModuleVisibility[];
  onToggle: (roleId: ModuleVisibility["roleId"], moduleId: keyof ModuleVisibility["modules"], enabled: boolean) => void;
}) {
  const { roles } = usePortal();
  const getRoleName = (roleId: RoleId) => roles.find((role) => role.id === roleId)?.name ?? roleId;

  return (
    <Tabs defaultValue={visibility[0]?.roleId}>
      <TabsList className="flex flex-wrap">
        {visibility.map((item) => (
          <TabsTrigger key={item.roleId} value={item.roleId}>
            {getRoleName(item.roleId)}
          </TabsTrigger>
        ))}
      </TabsList>

      {visibility.map((item) => (
        <TabsContent key={item.roleId} value={item.roleId}>
          <div className="space-y-6">
          <Card className="border-border/80">
            <CardHeader>
              <CardTitle>Akses modul untuk {getRoleName(item.roleId)}</CardTitle>
              <CardDescription>Perubahan di sini langsung memengaruhi sidebar dan halaman kerja persona yang bersangkutan.</CardDescription>
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

          <Card className="border-border/80">
            <CardHeader>
              <CardTitle>Akses grid aplikasi Portal</CardTitle>
              <CardDescription>
                Mengatur kartu pada bagian Aplikasi yang Bisa Dibuka di Portal ALETA, termasuk aplikasi eksternal seperti SIPP dan APS Badilag.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              {portalVisibilityApps.map((app) => (
                <label
                  key={app.id}
                  className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-muted/35 p-4"
                >
                  <span className="space-y-1">
                    <span className="block font-semibold text-foreground">{app.label}</span>
                    <span className="block text-sm text-muted-foreground">{app.description}</span>
                  </span>
                  <Switch
                    checked={item.modules[app.id]}
                    onCheckedChange={(checked) => onToggle(item.roleId, app.id, checked)}
                  />
                </label>
              ))}
            </CardContent>
          </Card>
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function PhotoInput({
  value,
  onChange,
}: {
  value?: string;
  onChange: (value?: string) => void;
}) {
  const [photoError, setPhotoError] = useState("");

  return (
    <label className="block rounded-[1.2rem] border border-border/80 bg-background/60 p-4">
      <span className="mb-2 block text-sm font-semibold text-foreground">
        Foto Profil
      </span>
      <Input
        type="file"
        accept="image/*"
        className="h-11 cursor-pointer text-sm"
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
