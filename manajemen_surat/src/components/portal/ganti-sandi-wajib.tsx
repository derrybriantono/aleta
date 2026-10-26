"use client";

import { useState } from "react";
import { KeyRound, LoaderCircle, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { ambilKeamanan } from "@/lib/keamanan-klien";
import { withBasePath } from "@/lib/base-path";

/**
 * Layar "Ganti sandi sekarang" (Bagian 6a). Hanya dirender tata letak portal
 * bila kebijakan sandi MENYALA dan akun ini dipaksa ganti atau sandinya
 * kedaluwarsa; selama saklar mati layar ini tidak pernah muncul.
 */
export function GantiSandiWajib({ alasan, nama }: { alasan: "dipaksa" | "kedaluwarsa"; nama: string }) {
  const [lama, setLama] = useState("");
  const [baru, setBaru] = useState("");
  const [ulang, setUlang] = useState("");
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);

  const kirim = async () => {
    setGalat("");
    if (baru !== ulang) {
      setGalat("Sandi baru dan pengulangannya tidak sama.");
      return;
    }
    setSibuk(true);
    try {
      await ambilKeamanan("/api/keamanan/ganti-sandi", { method: "POST", body: JSON.stringify({ sandiLama: lama, sandiBaru: baru }) });
      window.location.reload();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Sandi belum dapat diganti.");
      setSibuk(false);
    }
  };

  const keluar = async () => {
    try {
      await authClient.signOut();
    } finally {
      window.location.href = withBasePath("/login");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4" data-ganti-sandi-wajib>
      <Card className="w-full max-w-md bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <KeyRound className="h-5 w-5 text-primary" /> Ganti sandi sekarang
          </CardTitle>
          <CardDescription>
            {nama ? `${nama}, ` : ""}
            {alasan === "kedaluwarsa"
              ? "masa berlaku sandi Anda sudah habis. Buat sandi baru untuk melanjutkan."
              : "admin meminta Anda membuat sandi baru sebelum melanjutkan."}{" "}
            Sandi baru tidak boleh sama dengan sandi yang pernah dipakai dan harus memenuhi aturan sandi satker.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-foreground">Sandi sekarang</span>
            <Input type="password" autoComplete="current-password" value={lama} onChange={(e) => setLama(e.target.value)} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-foreground">Sandi baru</span>
            <Input type="password" autoComplete="new-password" value={baru} onChange={(e) => setBaru(e.target.value)} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-foreground">Ulangi sandi baru</span>
            <Input type="password" autoComplete="new-password" value={ulang} onChange={(e) => setUlang(e.target.value)} />
          </label>
          {galat && <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{galat}</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={() => void kirim()} disabled={sibuk || !lama || !baru || !ulang}>
              {sibuk ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
              Simpan sandi baru
            </Button>
            <Button variant="outline" onClick={() => void keluar()} disabled={sibuk}>
              <LogOut className="mr-2 h-4 w-4" /> Keluar
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
