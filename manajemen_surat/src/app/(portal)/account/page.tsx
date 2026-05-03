"use client";

import { useState } from "react";
import { Camera, Save, ShieldCheck } from "lucide-react";

import { getResolvedActingAssignment } from "@/core/organization/service";
import { UserAvatar } from "@/components/portal/user-avatar";
import { EmptyState, PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePortal } from "@/lib/app-state";
import { getRoleLabel, getUserPositionLabel, getUserRoleBadge } from "@/lib/permissions";
import { type UserPersona } from "@/lib/types";

export default function AccountPage() {
  const { currentUser, updateProfile } = usePortal();

  if (!currentUser) {
    return <EmptyState title="Akun tidak tersedia" description="Silakan login ulang untuk membuka pengaturan profil." />;
  }

  return <AccountEditor key={currentUser.id} currentUser={currentUser} onSave={updateProfile} />;
}

function AccountEditor({
  currentUser,
  onSave,
}: {
  currentUser: UserPersona;
  onSave: (payload: {
    email: string;
    password?: string;
    profilePhotoUrl?: string;
  }) => Promise<{ ok: boolean; message: string }>;
}) {
  const activeActingAssignment = getResolvedActingAssignment(currentUser);
  const [email, setEmail] = useState(currentUser.email);
  const [password, setPassword] = useState("");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | undefined>(currentUser.profilePhotoUrl);
  const [formError, setFormError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Pengaturan Akun"
        title="Edit Profil / Akun"
        description="Email, password, dan foto profil disimpan terpusat sehingga langsung berlaku di ALETA maupun sub-modul Manajemen Surat. Penugasan PLH/PLT kini dikelola khusus dari Dashboard Manajemen Surat."
      />

      <div className="grid gap-6 xl:grid-cols-[0.7fr_1.3fr]">
        <Card className="border-border/80">
          <CardHeader>
            <CardTitle>Foto Profil</CardTitle>
            <CardDescription>Gunakan upload native browser agar tetap ringan tanpa library tambahan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-col items-center gap-4 text-center">
              <UserAvatar
                name={currentUser.name}
                profilePhotoUrl={profilePhotoUrl}
                className="h-28 w-28 rounded-[2rem]"
                textClassName="text-xl"
              />
              <div className="space-y-1">
                <p className="font-semibold text-foreground">{currentUser.name}</p>
                <p className="text-sm text-muted-foreground">{getUserRoleBadge(currentUser)}</p>
                <Badge variant="outline">{getUserPositionLabel(currentUser)}</Badge>
              </div>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-foreground">Upload Foto Profil</span>
              <Input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  if (file.size > 1024 * 1024) {
                    setSaved(false);
                    setPhotoError("Ukuran foto maksimal 1 MB agar penyimpanan tetap ringan.");
                    return;
                  }

                  const reader = new FileReader();
                  reader.onload = () => {
                    setSaved(false);
                    setPhotoError("");
                    setProfilePhotoUrl(typeof reader.result === "string" ? reader.result : undefined);
                  };
                  reader.readAsDataURL(file);
                }}
              />
            </label>

            {photoError ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {photoError}
              </div>
            ) : null}

            <Badge variant="muted" className="w-fit">
              Native file input
            </Badge>
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader>
            <CardTitle>Informasi Akun</CardTitle>
            <CardDescription>Pengaturan akun ini dipakai bersama di ALETA dan di dalam sub-modul Manajemen Surat.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="account-name">
                  Nama Pengguna
                </label>
                <Input id="account-name" value={currentUser.name} disabled />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="account-username">
                  Username
                </label>
                <Input id="account-username" value={currentUser.username} disabled />
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="account-role">
                  Peran Dasar
                </label>
                <Input id="account-role" value={getRoleLabel(currentUser.roleId)} disabled />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="account-position">
                  Jabatan Efektif
                </label>
                <Input id="account-position" value={getUserPositionLabel(currentUser)} disabled />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="account-email">
                Email
              </label>
              <Input
                id="account-email"
                value={email}
                onChange={(event) => {
                  setSaved(false);
                  setFormError("");
                  setEmail(event.target.value);
                }}
                placeholder="Masukkan email baru"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="account-password">
                Password
              </label>
              <Input
                id="account-password"
                type="password"
                value={password}
                onChange={(event) => {
                  setSaved(false);
                  setFormError("");
                  setPassword(event.target.value);
                }}
                placeholder="Kosongkan jika password tidak diubah"
              />
            </div>

            <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">Penugasan Sementara PLH / PLT</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Penugasan dikelola dari Dashboard Manajemen Surat oleh Admin atau Super Admin sesuai kewenangan.
                  </p>
                </div>
                <Badge variant={activeActingAssignment ? "warning" : "outline"}>
                  {activeActingAssignment ? activeActingAssignment.type : "Nonaktif"}
                </Badge>
              </div>

              <div className="mt-4 rounded-2xl border border-dashed border-primary/25 bg-white px-4 py-3 text-sm text-muted-foreground">
                {activeActingAssignment ? (
                  <>
                    Akses efektif saat ini: <strong className="text-foreground">{getUserRoleBadge(currentUser)}</strong>.
                    Penugasan aktif mengikuti jabatan sementara yang sudah disimpan dari Dashboard Manajemen Surat.
                  </>
                ) : (
                  <>
                    Belum ada penugasan PLH/PLT aktif. Jika Anda ditugaskan sebagai pengganti, statusnya akan tampil
                    otomatis di sini setelah Admin atau Super Admin menyimpannya dari dashboard.
                  </>
                )}
              </div>
            </div>

            {formError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {formError}
              </div>
            ) : null}

            {saved ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                Profil berhasil diperbarui dan langsung tersinkron di seluruh portal.
              </div>
            ) : null}

            <Button
              className="w-full sm:w-auto"
              disabled={isSaving}
              onClick={async () => {
                if (!email.trim()) {
                  setSaved(false);
                  setFormError("Email tidak boleh kosong.");
                  return;
                }

                setIsSaving(true);
                const result = await onSave({
                  email: email.trim(),
                  password: password.trim() || undefined,
                  profilePhotoUrl,
                });
                setIsSaving(false);

                if (!result.ok) {
                  setSaved(false);
                  setFormError(result.message);
                  return;
                }

                setFormError("");
                setSaved(true);
                setPassword("");
              }}
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>

            <div className="rounded-[1.3rem] border border-dashed border-primary/30 bg-primary/5 p-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Sinkronisasi terpusat
              </div>
              <p className="mt-2">
                Email, password, dan foto profil yang Anda ubah di sini akan langsung tampil di ALETA dan header aplikasi surat karena memakai state akun yang sama.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
