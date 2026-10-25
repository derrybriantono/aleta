"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, Network, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { usePortal } from "@/lib/app-state";
import { ambilKeamanan } from "@/lib/keamanan-klien";

/**
 * Batas jaringan per peran (Bagian 6b). Bawaan semua peran "Dari mana pun" -
 * perilakunya sama dengan sebelum fitur ini. Rute /api/admin/keamanan/jaringan
 * menegakkan hak (baca Admin, ubah Super Admin) dan menolak aturan yang akan
 * mengunci akun Anda sendiri.
 */

type Subnet = { id: string; cidr: string; label: string; aktif: boolean };
type AturanPeran = { roleId: string; aturan: string };
type Aturan = { kode: string; label: string; tersedia: boolean };
type Muatan = {
  konfigurasi: { subnet: Subnet[]; aturan: AturanPeran[] };
  aturanTersedia: Aturan[];
  ipAnda: string;
  andaDalamKantor: boolean;
};

export function PanelJaringan({ bolehUbah }: { bolehUbah: boolean }) {
  const { roles } = usePortal();
  const [data, setData] = useState<Muatan | null>(null);
  const [galat, setGalat] = useState("");
  const [info, setInfo] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [baru, setBaru] = useState({ cidr: "", label: "" });

  const muat = useCallback(async () => {
    try {
      setData(await ambilKeamanan<Muatan>("/api/admin/keamanan/jaringan"));
      setGalat("");
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Pengaturan jaringan belum dapat dimuat.");
    }
  }, []);
  useEffect(() => {
    const t = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(t);
  }, [muat]);

  const kirim = async (badan: Record<string, unknown>, pesan = "Tersimpan.") => {
    setSibuk(true);
    setInfo("");
    try {
      setData(await ambilKeamanan<Muatan>("/api/admin/keamanan/jaringan", { method: "POST", body: JSON.stringify(badan) }));
      setGalat("");
      setInfo(pesan);
      return true;
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Pengaturan jaringan tidak tersimpan.");
      return false;
    } finally {
      setSibuk(false);
    }
  };

  if (!data) {
    return galat ? (
      <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{galat}</p>
    ) : (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="h-4 w-4 animate-spin" /> Memuat pengaturan jaringan...
      </p>
    );
  }

  const aturanPeran = (roleId: string) => data.konfigurasi.aturan.find((a) => a.roleId === roleId)?.aturan ?? "mana-pun";
  const membatasi = data.konfigurasi.aturan.length > 0;

  return (
    <div className="space-y-6" data-panel="batas-jaringan">
      {galat && <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{galat}</p>}
      {info && <p className="text-sm text-muted-foreground">{info}</p>}

      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Network className="h-5 w-5 text-primary" /> Jaringan kantor
            <Badge variant={membatasi ? "warning" : "outline"}>{membatasi ? "Ada peran dibatasi" : "Tidak ada pembatasan"}</Badge>
          </CardTitle>
          <CardDescription>
            Daftar alamat jaringan yang dianggap kantor, ditulis seperti 192.168.10.0/24 (satu alamat boleh ditulis tanpa garis miring). Alamat peramban dibaca dari
            ujung X-Forwarded-For, bukan dari kiriman peramban.{" "}
            <span data-alamat-anda>
              Alamat Anda sekarang: <strong>{data.ipAnda || "tidak terbaca"}</strong>
              {data.ipAnda ? (data.andaDalamKantor ? " (di jaringan kantor)" : " (di luar jaringan kantor yang terdaftar)") : ""}.
            </span>
            {!bolehUbah && " Hanya Super Admin yang dapat mengubahnya."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.konfigurasi.subnet.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada jaringan kantor yang didaftarkan.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="p-2">Jaringan</th>
                  <th className="p-2">Keterangan</th>
                  <th className="p-2">Aktif</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {data.konfigurasi.subnet.map((s) => (
                  <tr key={s.id} className="border-t border-border/60">
                    <td className="p-2 font-mono text-xs">{s.cidr}</td>
                    <td className="p-2">{s.label || "-"}</td>
                    <td className="p-2">
                      <Switch
                        checked={s.aktif}
                        disabled={!bolehUbah || sibuk}
                        onCheckedChange={(v) => void kirim({ aksi: "aktif-subnet", id: s.id, aktif: v })}
                        aria-label={`Aktifkan ${s.cidr}`}
                      />
                    </td>
                    <td className="p-2 text-right">
                      {bolehUbah && (
                        <Button size="sm" variant="ghost" disabled={sibuk} onClick={() => void kirim({ aksi: "hapus-subnet", id: s.id }, "Jaringan dihapus.")} aria-label={`Hapus ${s.cidr}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {bolehUbah && (
            <div className="grid gap-2 md:grid-cols-6">
              <Input
                className="md:col-span-2"
                placeholder="Contoh: 192.168.10.0/24"
                value={baru.cidr}
                onChange={(e) => setBaru({ ...baru, cidr: e.target.value })}
                aria-label="Alamat jaringan"
              />
              <Input className="md:col-span-3" placeholder="Keterangan (misalnya: Kantor lantai 1)" value={baru.label} onChange={(e) => setBaru({ ...baru, label: e.target.value })} aria-label="Keterangan jaringan" />
              <Button
                disabled={sibuk || !baru.cidr.trim()}
                onClick={() =>
                  void kirim({ aksi: "tambah-subnet", cidr: baru.cidr, label: baru.label }, "Jaringan ditambahkan.").then((berhasil) => {
                    if (berhasil) setBaru({ cidr: "", label: "" });
                  })
                }
              >
                Tambah
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-base">Aturan per peran</CardTitle>
          <CardDescription>
            Bawaan semua peran &quot;Dari mana pun&quot;. Akun dengan beberapa peran memakai aturan yang paling longgar. Penolakan masuk tercatat di Riwayat Masuk sebagai
            &quot;Ditolak: jaringan&quot;. Sesi yang sudah ada tidak dihapus; ia kembali berjalan begitu akun berada di jaringan kantor.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="p-2">Peran</th>
                <th className="p-2">Boleh masuk</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.id} className="border-t border-border/60">
                  <td className="p-2">{r.name}</td>
                  <td className="p-2">
                    <NativeSelect
                      value={aturanPeran(r.id)}
                      disabled={!bolehUbah || sibuk}
                      onChange={(e) => void kirim({ aksi: "atur-peran", roleId: r.id, aturan: e.target.value })}
                      aria-label={`Aturan jaringan ${r.name}`}
                      className="h-9"
                    >
                      {data.aturanTersedia.map((a) => (
                        <option key={a.kode} value={a.kode} disabled={!a.tersedia}>
                          {a.label}
                          {a.tersedia ? "" : " (belum tersedia)"}
                        </option>
                      ))}
                    </NativeSelect>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
