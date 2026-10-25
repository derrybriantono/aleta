"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { DatabaseBackup, LoaderCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { ambilKeamanan } from "@/lib/keamanan-klien";

/**
 * Uji pulih cadangan (Bagian 6d) - saklar MATI bawaan. Mingguan, cadangan ALETA
 * terbaru dipulihkan ke basis data SEMENTARA, diperiksa, lalu dihapus. Basis data
 * yang dipakai ALETA tidak pernah disentuh.
 */

type Setelan = { aktif: boolean; hari: number; jam: string; toleransiPersen: number };
type Langkah = { nama: string; ok: boolean; ms: number; catatan: string };
type BarisTabel = { nama: string; pulih: number | null; produksi: number; selisihPersen: number; lulus: boolean };
type Rincian = {
  langkah: Langkah[];
  tabel: BarisTabel[];
  migrasi: { pulih: number | null; produksi: number | null; lulus: boolean | null };
  galatPsql: number;
  contohGalatPsql: string[];
  dbSementara: string;
};
type Baris = {
  id: string;
  mulaiPada: string;
  selesaiPada: string;
  pemicu: "jadwal" | "manual";
  oleh: string;
  status: "berjalan" | "berhasil" | "gagal";
  tingkat: string;
  bundel: string;
  berkas: string;
  pesan: string;
  durasiMs: number;
  dibersihkan: boolean;
  rincian: Rincian | null;
};
type Cadangan = { bundel: string; selesai: string; nama: string; byte: number; tersandi: boolean; umurJam: number };
type Muatan = { setelan: Setelan; riwayat: Baris[]; berjalan: boolean; cadanganTerbaru: Cadangan | null; dimulai?: boolean };

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function waktu(iso: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return `${new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Makassar", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d)} WITA`;
}
function ukuran(byte: number) {
  return byte >= 1024 ** 3 ? `${(byte / 1024 ** 3).toFixed(1)} GB` : `${(byte / 1024 ** 2).toFixed(1)} MB`;
}
function durasi(ms: number) {
  return ms >= 60_000 ? `${Math.round(ms / 60_000)} menit` : `${Math.max(1, Math.round(ms / 1000))} detik`;
}

export function PanelUjiPulih({ bolehUbah }: { bolehUbah: boolean }) {
  const [data, setData] = useState<Muatan | null>(null);
  const [isi, setIsi] = useState<Setelan | null>(null);
  const [galat, setGalat] = useState("");
  const [info, setInfo] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [buka, setBuka] = useState("");
  const pewaktu = useRef<number | null>(null);

  const muat = useCallback(async (ulangiPengaturan: boolean) => {
    try {
      const d = await ambilKeamanan<Muatan>("/api/admin/keamanan/uji-pulih");
      setData(d);
      if (ulangiPengaturan) setIsi(d.setelan);
      setGalat("");
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Uji pulih belum dapat dimuat.");
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void muat(true), 0);
    return () => window.clearTimeout(t);
  }, [muat]);

  // Selama uji berjalan, riwayat disegarkan tiap 5 detik.
  useEffect(() => {
    if (!data?.berjalan) return;
    pewaktu.current = window.setInterval(() => void muat(false), 5000);
    return () => {
      if (pewaktu.current) window.clearInterval(pewaktu.current);
    };
  }, [data?.berjalan, muat]);

  const simpan = async () => {
    if (!isi) return;
    setSibuk(true);
    setInfo("");
    try {
      const d = await ambilKeamanan<Muatan>("/api/admin/keamanan/uji-pulih", {
        method: "POST",
        body: JSON.stringify({ aksi: "setelan", aktif: isi.aktif, hari: Number(isi.hari), jam: isi.jam, toleransiPersen: Number(isi.toleransiPersen) }),
      });
      setData(d);
      setIsi(d.setelan);
      setGalat("");
      setInfo("Tersimpan.");
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Setelan uji pulih tidak tersimpan.");
    } finally {
      setSibuk(false);
    }
  };

  const jalankan = async () => {
    setSibuk(true);
    setInfo("");
    try {
      const d = await ambilKeamanan<Muatan>("/api/admin/keamanan/uji-pulih", { method: "POST", body: JSON.stringify({ aksi: "jalankan" }) });
      setData({ ...d, berjalan: true });
      setGalat("");
      setInfo("Uji dimulai. Hasilnya muncul di bawah dalam beberapa menit.");
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Uji pulih belum dapat dimulai.");
    } finally {
      setSibuk(false);
    }
  };

  if (!data || !isi) {
    return galat ? (
      <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{galat}</p>
    ) : (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="h-4 w-4 animate-spin" /> Memuat uji pulih cadangan...
      </p>
    );
  }

  return (
    <div className="space-y-6" data-panel="uji-pulih">
      {galat && <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{galat}</p>}
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <DatabaseBackup className="h-5 w-5 text-primary" /> Uji pulih cadangan
            <Badge variant={isi.aktif ? "success" : "outline"}>{isi.aktif ? "Menyala" : "Mati"}</Badge>
          </CardTitle>
          <CardDescription>
            Tiap minggu, cadangan ALETA terbaru dipulihkan ke basis data sementara, diperiksa (migrasi dan jumlah baris tabel penting), lalu basis data sementara dihapus. Basis
            data yang dipakai ALETA tidak pernah disentuh. Bila gagal, admin diberi tahu lewat lonceng dan WhatsApp. Bawaan mati.
            {!bolehUbah && " Hanya Super Admin yang dapat mengubahnya."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center justify-between gap-4 rounded-xl border border-border p-3">
            <span>
              <span className="block text-sm font-medium text-foreground">Nyalakan uji pulih mingguan</span>
              <span className="block text-xs text-muted-foreground">Saran: Minggu pukul 03.00, sesudah pencocokan Cermin pukul 02.00.</span>
            </span>
            <Switch checked={isi.aktif} onCheckedChange={(v) => setIsi({ ...isi, aktif: v })} disabled={!bolehUbah} aria-label="Nyalakan uji pulih mingguan" />
          </label>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-foreground">Hari</span>
              <NativeSelect value={isi.hari} onChange={(e) => setIsi({ ...isi, hari: Number(e.target.value) })} disabled={!bolehUbah}>
                {HARI.map((h, i) => (
                  <option key={h} value={i}>
                    {h}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-foreground">Jam (WITA)</span>
              <Input type="time" value={isi.jam} onChange={(e) => setIsi({ ...isi, jam: e.target.value })} disabled={!bolehUbah} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-foreground">Toleransi selisih baris (%)</span>
              <Input type="number" min={0} max={90} value={isi.toleransiPersen} onChange={(e) => setIsi({ ...isi, toleransiPersen: Number(e.target.value) })} disabled={!bolehUbah} />
              <span className="block text-xs text-muted-foreground">Cadangan lebih tua daripada data sekarang; bawaan boleh kurang 30%.</span>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void simpan()} disabled={!bolehUbah || sibuk}>
              Simpan setelan
            </Button>
            <Button variant="outline" onClick={() => void jalankan()} disabled={!bolehUbah || sibuk || data.berjalan || !data.cadanganTerbaru}>
              {data.berjalan ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
              {data.berjalan ? "Uji sedang berjalan" : "Jalankan uji sekarang"}
            </Button>
            {info && <span className="text-sm text-muted-foreground">{info}</span>}
          </div>
          <p className="text-sm text-muted-foreground" data-cadangan-terbaru>
            {data.cadanganTerbaru
              ? `Cadangan ALETA terbaru: bundel ${data.cadanganTerbaru.bundel}, ${ukuran(data.cadanganTerbaru.byte)}${data.cadanganTerbaru.tersandi ? ", tersandi" : ", tanpa sandi"}, umur ${data.cadanganTerbaru.umurJam} jam.`
              : "Belum ada cadangan ALETA yang selesai di server. Nyalakan Sinkron & cadangan lebih dulu."}
          </p>
        </CardContent>
      </Card>

      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-base">Hasil uji terakhir</CardTitle>
          <CardDescription>Sepuluh percobaan terakhir. Tekan satu baris untuk melihat langkah dan tabel yang dibandingkan.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {data.riwayat.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum pernah diuji.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="p-2">Waktu</th>
                  <th className="p-2">Hasil</th>
                  <th className="p-2">Cadangan</th>
                  <th className="p-2">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {data.riwayat.map((b) => (
                  <Fragment key={b.id}>
                    <tr className="cursor-pointer border-t border-border/60 align-top hover:bg-muted/40" onClick={() => setBuka(buka === b.id ? "" : b.id)}>
                      <td className="p-2 whitespace-nowrap">
                        {waktu(b.mulaiPada)}
                        <span className="block text-xs text-muted-foreground">{b.pemicu === "jadwal" ? "Jadwal" : `Manual${b.oleh ? ` - ${b.oleh}` : ""}`}</span>
                      </td>
                      <td className="p-2">
                        <Badge variant={b.status === "berhasil" ? (b.tingkat === "peringatan" ? "warning" : "success") : b.status === "berjalan" ? "info" : "danger"}>
                          {b.status === "berhasil" ? (b.tingkat === "peringatan" ? "Berhasil (peringatan)" : "Berhasil") : b.status === "berjalan" ? "Berjalan" : "Gagal"}
                        </Badge>
                        {b.status !== "berjalan" && <span className="block text-xs text-muted-foreground">{durasi(b.durasiMs)}</span>}
                      </td>
                      <td className="p-2 font-mono text-xs">{b.bundel || "-"}</td>
                      <td className="p-2">{b.pesan || (b.status === "berjalan" ? "Sedang memulihkan..." : "-")}</td>
                    </tr>
                    {buka === b.id && b.rincian && (
                      <tr className="border-t border-border/40 bg-muted/30">
                        <td colSpan={4} className="space-y-3 p-3" data-rincian-uji>
                          <ol className="list-decimal space-y-1 pl-5 text-xs">
                            {b.rincian.langkah.map((l, i) => (
                              <li key={`${l.nama}-${i}`}>
                                <span className={l.ok ? "text-foreground" : "font-medium text-destructive"}>{l.nama}</span>
                                {l.catatan ? <span className="text-muted-foreground"> - {l.catatan}</span> : null}
                              </li>
                            ))}
                          </ol>
                          {b.rincian.tabel.length > 0 && (
                            <table className="w-full text-xs">
                              <thead className="text-left text-muted-foreground">
                                <tr>
                                  <th className="p-1">Tabel</th>
                                  <th className="p-1">Produksi</th>
                                  <th className="p-1">Hasil pulih</th>
                                  <th className="p-1">Selisih</th>
                                </tr>
                              </thead>
                              <tbody>
                                {b.rincian.tabel.map((t) => (
                                  <tr key={t.nama} className="border-t border-border/40">
                                    <td className="p-1 font-mono">{t.nama}</td>
                                    <td className="p-1">{t.produksi}</td>
                                    <td className="p-1">{t.pulih ?? "tidak ada"}</td>
                                    <td className={`p-1 ${t.lulus ? "" : "font-medium text-destructive"}`}>{t.selisihPersen}%</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Migrasi: hasil pulih {b.rincian.migrasi.pulih ?? "-"} dari produksi {b.rincian.migrasi.produksi ?? "-"}. Galat psql: {b.rincian.galatPsql}.{" "}
                            {b.dibersihkan ? "Basis data sementara sudah dihapus." : "Basis data sementara BELUM terhapus."}
                          </p>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
