"use client";

import { LogOut, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { withBasePath } from "@/lib/base-path";

/**
 * Layar "Akses dari jaringan ini tidak diizinkan" (Bagian 6b). Hanya dirender tata
 * letak portal bila aturan jaringan peran akun ini membatasi dan alamat peramban di
 * luar jaringan kantor. Selama semua peran "dari mana pun" (bawaan), tidak pernah muncul.
 */
export function JaringanDitolak({ pesan }: { pesan: string }) {
  const keluar = async () => {
    try {
      await authClient.signOut();
    } finally {
      window.location.href = withBasePath("/login");
    }
  };
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4" data-jaringan-ditolak>
      <Card className="w-full max-w-md bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldAlert className="h-5 w-5 text-destructive" /> Akses dari jaringan ini tidak diizinkan
          </CardTitle>
          <CardDescription>{pesan}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Sesi Anda tidak dihapus. Begitu Anda kembali ke jaringan kantor, buka ALETA lagi dan semuanya berjalan seperti biasa.
          </p>
          <Button variant="outline" onClick={() => void keluar()}>
            <LogOut className="mr-2 h-4 w-4" /> Keluar
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
