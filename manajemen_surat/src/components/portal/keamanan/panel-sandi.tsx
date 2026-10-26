"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, LoaderCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ambilKeamanan } from "@/lib/keamanan-klien";

/**
 * Kebijakan sandi (Bagian 6a) - saklar MATI bawaan. Selama mati, aturan sandi
 * persis seperti sebelumnya. Rute /api/admin/keamanan/sandi menegakkan hak
 * (baca Admin, ubah Super Admin); tombol yang dinonaktifkan di sini hanya kenyamanan.
 */

type Kebijakan = {
  aktif: boolean;
  versi: number;
  panjangMin: number;
  tolakUmum: boolean;
  tolakIdentitas: boolean;
  wajibCampuran: boolean;
  riwayatN: number;
  masaBerlakuHari: number;
  aktifSejak: string;
};
type Belum = { userId: string; username: string; nama: string; peran: string; alasan: "dipaksa" | "kedaluwarsa" | "belum-diganti"; gantiPada: string };
type Muatan = { kebijakan: Kebijakan; belumMemenuhi: Belum[]; batas: { panjangMin: number[]; riwayatN: number[]; masaBerlakuHari: number[] } };

const LABEL_ALASAN: Record<Belum["alasan"], string> = {
  dipaksa: "Wajib ganti saat masuk",
  kedaluwarsa: "Sandi kedaluwarsa",
  "belum-diganti": "Belum diganti sejak aturan ini",
};

function waktuPendek(iso: string) {
  if (!iso) return "belum tercatat";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "belum tercatat";
  return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Makassar", day: "numeric", month: "short", year: "numeric" }).format(d);
}

export function PanelSandi({ bolehUbah }: { bolehUbah: boolean }) {
  const [data, setData] = useState<Muatan | null>(null);
  const [isi, setIsi] = useState<Kebijakan | null>(null);
  const [galat, setGalat] = useState("");
  const [info, setInfo] = useState("");
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(async () => {
    try {
      const d = await ambilKeamanan<Muatan>("/api/admin/keamanan/sandi");
      setData(d);
      setIsi(d.kebijakan);
      setGalat("");
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Kebijakan sandi belum dapat dimuat.");
    }
  }, []);
  useEffect(() => {
    const t = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(t);
  }, [muat]);

  const simpan = async () => {
    if (!isi) return;
    setSibuk(true);
    setInfo("");
    try {
      const d = await ambilKeamanan<Muatan>("/api/admin/keamanan/sandi", {
        method: "POST",
        body: JSON.stringify({
          aktif: isi.aktif,
          panjangMin: Number(isi.panjangMin),
          tolakUmum: isi.tolakUmum,
          tolakIdentitas: isi.tolakIdentitas,
          wajibCampuran: isi.wajibCampuran,
          riwayatN: Number(isi.riwayatN),
          masaBerlakuHari: Number(isi.masaBerlakuHari),
        }),
      });
      setData(d);
      setIsi(d.kebijakan);
      setGalat("");
      setInfo("Tersimpan.");
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Kebijakan sandi tidak tersimpan.");
    } finally {
      setSibuk(false);
    }
  };

  const paksa = async (userId: string, nilai: boolean) => {
    try {
      const d = await ambilKeamanan<{ belumMemenuhi: Belum[] }>("/api/admin/keamanan/sandi/paksa-ganti", {
        method: "POST",
        body: JSON.stringify({ userId, paksa: nilai }),
      });
      setData((lama) => (lama ? { ...lama, belumMemenuhi: d.belumMemenuhi } : lama));
      setGalat("");
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Tanda ganti sandi tidak tersimpan.");
    }
  };

  if (!isi || !data) {
    return galat ? (
      <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{galat}</p>
    ) : (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="h-4 w-4 animate-spin" /> Memuat kebijakan sandi...
      </p>
    );
  }

  const ubah = <K extends keyof Kebijakan>(k: K, v: Kebijakan[K]) => setIsi({ ...isi, [k]: v });

  return (
    <div className="space-y-6" data-panel="kebijakan-sandi">
      {galat && <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{galat}</p>}
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-5 w-5 text-primary" /> Kebijakan sandi
            <Badge variant={isi.aktif ? "success" : "outline"}>{isi.aktif ? "Menyala" : "Mati"}</Badge>
          </CardTitle>
          <CardDescription>
            Selama mati, aturan sandi sama seperti sekarang. Bila menyala, aturan di bawah berlaku untuk sandi yang baru dibuat atau diganti; sandi yang sudah ada
            tidak diperiksa ulang (yang tersimpan hanya sidik, bukan sandinya).
            {!bolehUbah && " Hanya Super Admin yang dapat mengubahnya."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center justify-between gap-4 rounded-xl border border-border p-3">
            <span>
              <span className="block text-sm font-medium text-foreground">Nyalakan kebijakan sandi</span>
              <span className="block text-xs text-muted-foreground">Bawaan mati.</span>
            </span>
            <Switch checked={isi.aktif} onCheckedChange={(v) => ubah("aktif", v)} disabled={!bolehUbah} aria-label="Nyalakan kebijakan sandi" />
          </label>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-foreground">Panjang minimal</span>
              <Input
                type="number"
                min={data.batas.panjangMin[0]}
                max={data.batas.panjangMin[1]}
                value={isi.panjangMin}
                onChange={(e) => ubah("panjangMin", Number(e.target.value))}
                disabled={!bolehUbah}
              />
              <span className="block text-xs text-muted-foreground">Bawaan 8 karakter (sama dengan aturan pulihkan sandi sekarang).</span>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-foreground">Larang pakai ulang sandi terakhir</span>
              <Input
                type="number"
                min={data.batas.riwayatN[0]}
                max={data.batas.riwayatN[1]}
                value={isi.riwayatN}
                onChange={(e) => ubah("riwayatN", Number(e.target.value))}
                disabled={!bolehUbah}
              />
              <span className="block text-xs text-muted-foreground">Jumlah sandi terakhir yang tidak boleh dipakai lagi. 0 = tidak dilarang.</span>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-foreground">Masa berlaku sandi (hari)</span>
              <Input
                type="number"
                min={data.batas.masaBerlakuHari[0]}
                max={data.batas.masaBerlakuHari[1]}
                value={isi.masaBerlakuHari}
                onChange={(e) => ubah("masaBerlakuHari", Number(e.target.value))}
                disabled={!bolehUbah}
              />
              <span className="block text-xs text-muted-foreground">0 = sandi tidak kedaluwarsa. Dihitung dari penggantian sandi terakhir.</span>
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {(
              [
                ["tolakUmum", "Tolak sandi umum", "Misalnya 123456, password, atau nama kantor."],
                ["tolakIdentitas", "Tolak nama, username, NIP, email", "Sandi tidak boleh memuat identitas pemiliknya."],
                ["wajibCampuran", "Wajib huruf dan angka", "Minimal satu huruf dan satu angka."],
              ] as const
            ).map(([kunci, judul, ket]) => (
              <label key={kunci} className="flex items-start justify-between gap-3 rounded-xl border border-border p-3">
                <span>
                  <span className="block text-sm font-medium text-foreground">{judul}</span>
                  <span className="block text-xs text-muted-foreground">{ket}</span>
                </span>
                <Switch checked={isi[kunci]} onCheckedChange={(v) => ubah(kunci, v)} disabled={!bolehUbah} aria-label={judul} />
              </label>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void simpan()} disabled={!bolehUbah || sibuk}>
              {sibuk ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
              Simpan kebijakan sandi
            </Button>
            {info && <span className="text-sm text-muted-foreground">{info}</span>}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-base">Akun yang belum memenuhi</CardTitle>
          <CardDescription>
            {isi.aktif
              ? "Akun yang sandinya dipaksa diganti, sudah kedaluwarsa, atau belum pernah diganti sejak aturan ini berlaku. Sandi lama tetap bisa dipakai masuk sampai akun menggantinya."
              : "Daftar muncul setelah kebijakan sandi dinyalakan."}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {data.belumMemenuhi.length === 0 ? (
            <p className="text-sm text-muted-foreground">{isi.aktif ? "Semua akun sudah memenuhi." : "Kebijakan sandi sedang mati."}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="p-2">Akun</th>
                  <th className="p-2">Keterangan</th>
                  <th className="p-2">Sandi terakhir diganti</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {data.belumMemenuhi.map((b) => (
                  <tr key={b.userId} className="border-t border-border">
                    <td className="p-2">
                      <span className="font-medium text-foreground">{b.nama}</span> <span className="text-muted-foreground">({b.username})</span>
                    </td>
                    <td className="p-2">
                      <Badge variant={b.alasan === "belum-diganti" ? "outline" : "danger"}>{LABEL_ALASAN[b.alasan]}</Badge>
                    </td>
                    <td className="p-2 text-muted-foreground">{waktuPendek(b.gantiPada)}</td>
                    <td className="p-2 text-right">
                      {b.alasan === "dipaksa" ? (
                        <Button size="sm" variant="outline" disabled={!bolehUbah} onClick={() => void paksa(b.userId, false)}>
                          Batalkan paksaan
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" disabled={!bolehUbah} onClick={() => void paksa(b.userId, true)}>
                          Paksa ganti sandi
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
