"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, LoaderCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiPath } from "@/lib/base-path";

/**
 * "Verifikasi dua langkah" di halaman Akun (E5): authenticator MILIK SENDIRI,
 * perangkat tepercaya, dan sisa kode cadangan. Authenticator boleh didaftarkan
 * lebih dulu; kodenya baru ditagih setelah Super Admin menyalakan verifikasi.
 */
type Status = {
  authenticatorAktif: boolean;
  authenticatorMenunggu: boolean;
  kodeCadanganSisa: number;
  perangkatTepercaya: Array<{ perangkatId: string; metode: string; dibuatPada: string; sampai: string }>;
  nomorWhatsapp: string;
  saklar: { otpWhatsapp: boolean; authenticator: boolean };
  aturan: string;
  passkey: boolean;
};
type Pendaftaran = { rahasia: string; uri: string; qr: string };

async function panggil<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(apiPath(url), { credentials: "include", cache: "no-store", ...init, headers: { "content-type": "application/json" } });
  const j = (await r.json().catch(() => null)) as { ok?: boolean; data?: T; error?: { message?: string } } | null;
  if (!r.ok || !j?.ok) throw new Error(j?.error?.message ?? "Permintaan belum berhasil.");
  return j.data as T;
}

const waktu = (iso: string) => new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Makassar" });
const NAMA_ATURAN: Record<string, string> = { wajib: "Wajib", "luar-kantor": "Hanya dari luar kantor", opsional: "Opsional", mati: "Tidak diminta" };

export function VerifikasiSaya() {
  const [status, setStatus] = useState<Status | null>(null);
  const [daftar, setDaftar] = useState<Pendaftaran | null>(null);
  const [kode, setKode] = useState("");
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(async () => {
    try {
      setStatus(await panggil<Status>("/api/portal/verifikasi"));
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(t);
  }, [muat]);

  const jalankan = async (fn: () => Promise<void>) => {
    setSibuk(true);
    setGalat("");
    try {
      await fn();
      await muat();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Permintaan belum berhasil.");
    } finally {
      setSibuk(false);
    }
  };

  if (!status) return null;

  return (
    <Card className="bg-card" data-verifikasi-saya>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4 text-primary" aria-hidden />
          Verifikasi dua langkah
          <Badge variant={status.authenticatorAktif ? "success" : "muted"}>{status.authenticatorAktif ? "Authenticator aktif" : "Authenticator belum dipasang"}</Badge>
        </CardTitle>
        <CardDescription>
          Aturan untuk peran Anda: {NAMA_ATURAN[status.aturan] ?? status.aturan}.{" "}
          {status.saklar.otpWhatsapp || status.saklar.authenticator
            ? "Kode ditagih di perangkat baru atau dari luar jaringan kantor."
            : "Kode belum ditagih; Super Admin belum menyalakannya. Anda boleh memasang authenticator lebih dulu."}
          {status.nomorWhatsapp ? ` Kode WhatsApp dikirim ke ${status.nomorWhatsapp}.` : " Nomor WhatsApp belum diisi di profil."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {galat && <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-destructive">{galat}</p>}

        {!status.authenticatorAktif && !daftar && (
          <Button disabled={sibuk} onClick={() => void jalankan(async () => setDaftar(await panggil<Pendaftaran>("/api/portal/verifikasi/authenticator", { method: "POST", body: JSON.stringify({ aksi: "mulai" }) })))}>
            {sibuk && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
            Pasang authenticator
          </Button>
        )}

        {daftar && !status.authenticatorAktif && (
          <div className="space-y-3 rounded-xl border border-border p-3">
            <p>Pindai kode ini dengan Google Authenticator, Microsoft Authenticator, atau sejenisnya. Boleh dipindai di dua HP sekaligus sekarang juga.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={daftar.qr} alt="Kode QR authenticator" width={220} height={220} className="rounded-lg border border-border bg-white" />
            <p className="break-all text-xs text-muted-foreground">Atau ketik rahasia ini: {daftar.rahasia}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Input value={kode} inputMode="numeric" maxLength={8} aria-label="Kode dari authenticator" placeholder="6 angka dari aplikasi" onChange={(e) => setKode(e.target.value)} className="max-w-48" />
              <Button
                disabled={sibuk || !kode.trim()}
                onClick={() =>
                  void jalankan(async () => {
                    await panggil("/api/portal/verifikasi/authenticator", { method: "POST", body: JSON.stringify({ aksi: "konfirmasi", kode }) });
                    setDaftar(null);
                    setKode("");
                  })
                }
              >
                Aktifkan
              </Button>
            </div>
          </div>
        )}

        {status.authenticatorAktif && (
          <div className="flex flex-wrap items-center gap-2">
            <Input value={kode} inputMode="numeric" maxLength={12} aria-label="Kode untuk menghapus authenticator" placeholder="Kode yang berlaku" onChange={(e) => setKode(e.target.value)} className="max-w-48" />
            <Button
              variant="outline"
              disabled={sibuk || !kode.trim()}
              onClick={() =>
                void jalankan(async () => {
                  await panggil("/api/portal/verifikasi/authenticator", { method: "POST", body: JSON.stringify({ aksi: "hapus", kode }) });
                  setKode("");
                })
              }
            >
              Hapus authenticator
            </Button>
          </div>
        )}

        <p className="text-muted-foreground">Kode cadangan tersisa: {status.kodeCadanganSisa}. Bila HP hilang, minta admin membuatkan kode cadangan.</p>

        {status.perangkatTepercaya.length > 0 && (
          <div className="space-y-2">
            <p className="font-medium text-foreground">Perangkat tepercaya</p>
            <ul className="space-y-2">
              {status.perangkatTepercaya.map((p) => (
                <li key={p.perangkatId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-2">
                  <span className="text-xs text-muted-foreground">
                    Dipercaya {waktu(p.dibuatPada)}, berlaku sampai {waktu(p.sampai)}
                  </span>
                  <Button size="sm" variant="outline" disabled={sibuk} onClick={() => void jalankan(async () => void (await panggil("/api/portal/verifikasi/perangkat", { method: "DELETE", body: JSON.stringify({ perangkatId: p.perangkatId }) })))}>
                    Cabut
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {!status.passkey && <p className="text-xs text-muted-foreground">Passkey belum tersedia: hanya aktif bila ALETA dibuka lewat HTTPS.</p>}
      </CardContent>
    </Card>
  );
}
