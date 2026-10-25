"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { apiPath } from "@/lib/base-path";
import type { PengaturanVerifikasi } from "@/server/modules/verifikasi/pengaturan";

/**
 * Pengaturan verifikasi dua langkah (E5) - hanya Super Admin menyalakan;
 * Admin dan Super Admin boleh membantu pengguna yang kehilangan HP. MATI
 * bawaan: selama kedua saklar mati, tidak ada pengguna yang dimintai kode.
 */
type Peran = { id: string; nama: string; bawaan: string; terdaftar: number };
type Data = {
  pengaturan: PengaturanVerifikasi;
  peran: Peran[];
  masaTepercayaMaks: number;
  /** Sumber daftar jaringan kantor yang berlaku: "keamanan" = Pengaturan Keamanan (batas jaringan), "verifikasi" = daftar di panel ini. */
  jaringanKantor?: { sumber: "keamanan" | "verifikasi"; daftar: string[] };
};

async function panggil<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(apiPath(url), { credentials: "include", cache: "no-store", ...init, headers: { "content-type": "application/json" } });
  const j = (await r.json().catch(() => null)) as { ok?: boolean; data?: T; error?: { message?: string } } | null;
  if (!r.ok || !j?.ok) throw new Error(j?.error?.message ?? "Data belum dapat dimuat.");
  return j.data as T;
}

const ATURAN: Array<[string, string]> = [
  ["wajib", "Wajib (perangkat baru atau luar kantor)"],
  ["luar-kantor", "Hanya dari luar kantor"],
  ["opsional", "Opsional (bila sudah pasang authenticator)"],
  ["mati", "Tidak diminta"],
];

export function VerifikasiPanel({ bolehAtur }: { bolehAtur: boolean }) {
  const [data, setData] = useState<Data | null>(null);
  const [otpWa, setOtpWa] = useState(false);
  const [auth, setAuth] = useState(false);
  const [aturan, setAturan] = useState<Record<string, string>>({});
  const [subnet, setSubnet] = useState("");
  const [hari, setHari] = useState("30");
  const [galat, setGalat] = useState("");
  const [info, setInfo] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [bantuId, setBantuId] = useState("");
  const [kodeBaru, setKodeBaru] = useState<string[] | null>(null);

  const isi = useCallback((d: Data) => {
    setData(d);
    setOtpWa(d.pengaturan.otpWhatsapp);
    setAuth(d.pengaturan.authenticator);
    setAturan(d.pengaturan.aturanPeran);
    setSubnet(d.pengaturan.subnetKantor.join("\n"));
    setHari(String(d.pengaturan.masaTepercayaHari));
  }, []);

  useEffect(() => {
    if (!bolehAtur) return;
    let batal = false;
    void panggil<Data>("/api/admin/verifikasi")
      .then((d) => {
        if (!batal) isi(d);
      })
      .catch((e) => {
        if (!batal) setGalat(e instanceof Error ? e.message : "Pengaturan belum dapat dimuat.");
      });
    return () => {
      batal = true;
    };
  }, [bolehAtur, isi]);

  const simpan = async () => {
    setSibuk(true);
    setGalat("");
    setInfo("");
    try {
      const d = await panggil<Data>("/api/admin/verifikasi", {
        method: "POST",
        body: JSON.stringify({
          otpWhatsapp: otpWa,
          authenticator: auth,
          aturanPeran: aturan,
          subnetKantor: subnet.split(/[\n,]+/).map((x) => x.trim()).filter(Boolean),
          masaTepercayaHari: Number(hari),
        }),
      });
      isi(d);
      setInfo(otpWa || auth ? "Disimpan. Verifikasi dua langkah MENYALA; perangkat Anda ini langsung dipercaya." : "Disimpan. Verifikasi dua langkah mati: tidak ada yang dimintai kode.");
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Belum dapat disimpan.");
    } finally {
      setSibuk(false);
    }
  };

  const bantu = async (aksi: "kode-cadangan" | "reset") => {
    setSibuk(true);
    setGalat("");
    setInfo("");
    setKodeBaru(null);
    try {
      const d = await panggil<{ kode?: string[]; untuk: string }>("/api/admin/verifikasi/bantuan", { method: "POST", body: JSON.stringify({ userId: bantuId.trim(), aksi }) });
      if (d.kode) setKodeBaru(d.kode);
      setInfo(aksi === "reset" ? `Authenticator ${d.untuk} dihapus dan perangkat tepercayanya dicabut.` : `Kode cadangan untuk ${d.untuk} dibuat. Catat sekarang; tidak akan ditampilkan lagi.`);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Bantuan belum berhasil.");
    } finally {
      setSibuk(false);
    }
  };

  const menyala = otpWa || auth;

  return (
    <div className="space-y-6" data-verifikasi-panel>
      {galat && <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{galat}</p>}
      {info && <p className="rounded-xl border border-border bg-card p-3 text-sm text-foreground">{info}</p>}

      {bolehAtur && (
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-base">
              <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
              Verifikasi dua langkah
              <Badge variant={data?.pengaturan.otpWhatsapp || data?.pengaturan.authenticator ? "warning" : "muted"}>
                {data?.pengaturan.otpWhatsapp || data?.pengaturan.authenticator ? "Menyala" : "Mati"}
              </Badge>
            </CardTitle>
            <CardDescription>
              Kedua saklar mati bawaan: selama mati, tidak ada pengguna yang dimintai kode. Pengguna boleh memasang authenticator lebih dulu di halaman Akun. Kode hanya diminta di perangkat baru atau dari
              luar jaringan kantor.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={otpWa} onChange={(e) => setOtpWa(e.target.checked)} className="mt-1 h-4 w-4" />
              <span>
                <span className="font-medium text-foreground">OTP WhatsApp</span>
                <span className="block text-muted-foreground">Kode 6 angka dikirim ke nomor WhatsApp di profil, berlaku 5 menit. Perlu bot WhatsApp yang menyala.</span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={auth} onChange={(e) => setAuth(e.target.checked)} className="mt-1 h-4 w-4" />
              <span>
                <span className="font-medium text-foreground">Authenticator (TOTP)</span>
                <span className="block text-muted-foreground">Kode dari aplikasi di HP pengguna; kode QR boleh dipindai di dua HP.</span>
              </span>
            </label>
            <p className="text-xs text-muted-foreground">Passkey disiapkan tetapi belum aktif: hanya sah bila ALETA dibuka lewat HTTPS (saat ini http).</p>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Aturan per peran</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {data?.peran.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 rounded-xl border border-border p-2">
                    <span className="text-sm text-foreground">
                      {p.nama} <span className="text-xs text-muted-foreground">({p.terdaftar} authenticator)</span>
                    </span>
                    <NativeSelect aria-label={`Aturan ${p.nama}`} value={aturan[p.id] ?? p.bawaan} onChange={(e) => setAturan((a) => ({ ...a, [p.id]: e.target.value }))} className="max-w-56">
                      {ATURAN.map(([v, t]) => (
                        <option key={v} value={v}>
                          {t}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="subnet-verifikasi" className="text-sm font-medium text-foreground">
                Jaringan kantor (satu per baris, contoh 192.168.10.0/24)
              </label>
              {data?.jaringanKantor?.sumber === "keamanan" && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Daftar ini dipakai bersama Pengaturan Keamanan (batas jaringan per peran). Untuk mengubahnya, buka Pengaturan Keamanan.
                </p>
              )}
              <textarea
                id="subnet-verifikasi"
                rows={3}
                value={subnet}
                readOnly={data?.jaringanKantor?.sumber === "keamanan"}
                onChange={(e) => setSubnet(e.target.value)}
                className="mt-1 w-full rounded-xl border border-input/90 bg-card/70 p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              />
            </div>
            <div className="max-w-48">
              <label htmlFor="hari-verifikasi" className="text-sm font-medium text-foreground">
                Masa perangkat tepercaya (hari)
              </label>
              <Input id="hari-verifikasi" inputMode="numeric" value={hari} onChange={(e) => setHari(e.target.value)} />
            </div>
            {menyala && <p className="text-xs text-muted-foreground">Menyalakan membuat perangkat Anda ini langsung dipercaya supaya Anda tidak terkunci.</p>}
            <Button disabled={sibuk} onClick={() => void simpan()}>
              {sibuk && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-base">Bantu pengguna yang kehilangan HP</CardTitle>
          <CardDescription>Buat kode cadangan sekali pakai, atau reset authenticator. Admin hanya dapat membantu pengguna biasa. Tercatat di audit.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label htmlFor="bantu-id" className="text-sm font-medium text-foreground">
              ID akun
            </label>
            <Input id="bantu-id" value={bantuId} onChange={(e) => setBantuId(e.target.value)} placeholder="id akun (lihat di Manajemen Akun)" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={sibuk || !bantuId.trim()} onClick={() => void bantu("kode-cadangan")}>
              Buat kode cadangan
            </Button>
            <Button variant="outline" disabled={sibuk || !bantuId.trim()} onClick={() => void bantu("reset")}>
              Reset authenticator
            </Button>
          </div>
          {kodeBaru && (
            <ul className="grid gap-1 rounded-xl border border-border p-3 font-mono text-sm sm:grid-cols-2" data-kode-cadangan>
              {kodeBaru.map((k) => (
                <li key={k}>{k}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
