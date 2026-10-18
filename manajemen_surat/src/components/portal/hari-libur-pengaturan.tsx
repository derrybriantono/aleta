"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { apiPath } from "@/lib/base-path";
import { pasangTambahanLibur, sebutTanggalPanjang, tanggalSah, type DataHariLibur, type JenisLibur, type TambahanLibur } from "@/lib/hari-libur";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";

/**
 * Pengaturan > Hari libur (18 Okt 2026). Daftar SKB tampil apa adanya; Super
 * Admin dan Admin menambah libur daerah atau cuti bersama tambahan, atau
 * membatalkan tanggal SKB yang diubah SKB perubahan. Berlaku di Jadwal Sidang,
 * Jadwal Mediasi, Court Calendar, penetapan kembali, dan penetapan di ekstensi.
 */

const SEBUT_JENIS: Record<string, string> = {
  nasional: "Libur nasional",
  "cuti-bersama": "Cuti bersama",
  daerah: "Libur daerah",
  lain: "Lainnya",
};

async function panggil(init?: RequestInit): Promise<DataHariLibur & { terkirimKeBot?: boolean }> {
  const r = await fetch(apiPath("/api/hari-libur"), { cache: "no-store", ...init });
  const isi = (await r.json().catch(() => null)) as { ok?: boolean; data?: DataHariLibur & { terkirimKeBot?: boolean } } | null;
  if (!r.ok || !isi || isi.ok === false || !isi.data) throw new Error(pesanGalatPortal(isi, `Permintaan gagal (HTTP ${r.status}).`));
  return isi.data;
}

export function BagianHariLibur({ bolehUbah }: { bolehUbah: boolean }) {
  const [data, setData] = useState<DataHariLibur | null>(null);
  const [tambahan, setTambahan] = useState<TambahanLibur[]>([]);
  const [tahun, setTahun] = useState(String(new Date().getFullYear()));
  const [baru, setBaru] = useState<{ tanggal: string; nama: string; jenis: JenisLibur }>({ tanggal: "", nama: "", jenis: "daerah" });
  const [pesan, setPesan] = useState<{ jenis: "galat" | "berhasil"; teks: string } | null>(null);
  const [sibuk, setSibuk] = useState(false);

  useEffect(() => {
    let hidup = true;
    panggil()
      .then((d) => {
        if (!hidup) return;
        setData(d);
        setTambahan(d.tambahan);
      })
      .catch((e: unknown) => {
        if (hidup) setPesan({ jenis: "galat", teks: e instanceof Error ? e.message : String(e) });
      });
    return () => {
      hidup = false;
    };
  }, []);

  const daftarTahun = useMemo(() => {
    const s = new Set<string>([String(new Date().getFullYear()), String(new Date().getFullYear() + 1)]);
    for (const b of data?.libur ?? []) s.add(b.tanggal.slice(0, 4));
    for (const t of tambahan) s.add(t.tanggal.slice(0, 4));
    return [...s].sort();
  }, [data, tambahan]);

  const dihapus = new Set(tambahan.filter((t) => t.aksi === "hapus").map((t) => t.tanggal));
  const skbTahun = (data?.libur ?? []).filter((b) => b.asal === "skb" && b.tanggal.startsWith(tahun));
  // Tanggal SKB yang dibatalkan tidak lagi ada di data.libur - ditampilkan dari tambahan.
  const tambahanTahun = tambahan.filter((t) => t.tanggal.startsWith(tahun));
  const sumber = data?.sumber.find((s) => s.tahun === tahun);
  const berubah = JSON.stringify(tambahan) !== JSON.stringify(data?.tambahan ?? []);

  function tambahBaris() {
    setPesan(null);
    if (!tanggalSah(baru.tanggal)) return setPesan({ jenis: "galat", teks: "Pilih tanggalnya dulu." });
    if (!baru.nama.trim()) return setPesan({ jenis: "galat", teks: "Isi nama hari liburnya." });
    if (tambahan.some((t) => t.tanggal === baru.tanggal)) return setPesan({ jenis: "galat", teks: "Tanggal itu sudah ada di daftar tambahan." });
    setTambahan((x) => [...x, { tanggal: baru.tanggal, nama: baru.nama.trim(), jenis: baru.jenis, aksi: "tambah" as const }].sort((a, b) => a.tanggal.localeCompare(b.tanggal)));
    setTahun(baru.tanggal.slice(0, 4));
    setBaru({ tanggal: "", nama: "", jenis: baru.jenis });
  }

  async function simpan() {
    setSibuk(true);
    setPesan(null);
    try {
      const d = await panggil({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tambahan }) });
      setData(d);
      setTambahan(d.tambahan);
      pasangTambahanLibur(d.tambahan);
      setPesan({
        jenis: "berhasil",
        teks: d.terkirimKeBot
          ? "Tersimpan. Berlaku di Jadwal Sidang, Jadwal Mediasi, dan penetapan di ekstensi."
          : "Tersimpan di ALETA. Server bot belum terjangkau - pemeriksaan di bot memakai daftar ini begitu disimpan ulang saat bot menyala.",
      });
    } catch (e) {
      setPesan({ jenis: "galat", teks: e instanceof Error ? e.message : String(e) });
    } finally {
      setSibuk(false);
    }
  }

  return (
    <Card data-bagian-hari-libur="">
      <CardHeader>
        <CardTitle>Hari libur</CardTitle>
        <CardDescription>
          Tanggal sidang pada hari libur tidak dapat dipilih di Jadwal Sidang, Jadwal Mediasi, dan penetapan. Sabtu dan Minggu selalu libur. Tambahkan libur daerah atau cuti bersama tambahan di sini.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div role="tablist" aria-label="Tahun" className="flex flex-wrap gap-1.5">
          {daftarTahun.map((t) => (
            <Button key={t} size="sm" role="tab" aria-selected={tahun === t} variant={tahun === t ? "default" : "outline"} onClick={() => setTahun(t)}>
              {t}
            </Button>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          {sumber
            ? `Libur nasional dan cuti bersama ${tahun}: SKB Menteri Agama, Menteri Ketenagakerjaan, dan Menteri PANRB ${sumber.skb}.`
            : `SKB libur nasional ${tahun} belum dimuat. Hanya Sabtu, Minggu, dan tambahan di bawah yang dianggap libur.`}
        </p>

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5">Tanggal</th>
                <th className="px-2 py-1.5">Nama</th>
                <th className="px-2 py-1.5">Jenis</th>
                <th className="px-2 py-1.5">Asal</th>
                {bolehUbah ? <th className="px-2 py-1.5" /> : null}
              </tr>
            </thead>
            <tbody>
              {[
                ...skbTahun.map((b) => ({ tanggal: b.tanggal, nama: b.nama, jenis: b.jenis as string, asal: "SKB", batal: false })),
                ...tambahanTahun.map((t) => ({
                  tanggal: t.tanggal,
                  nama: t.aksi === "hapus" ? `${t.nama || "Tanggal SKB"} - dibatalkan` : t.nama,
                  jenis: t.jenis as string,
                  asal: t.aksi === "hapus" ? "Dibatalkan" : "Tambahan",
                  batal: t.aksi === "hapus",
                })),
              ]
                .sort((a, b) => a.tanggal.localeCompare(b.tanggal))
                .map((r) => (
                  <tr key={`${r.asal}-${r.tanggal}`} className="border-t">
                    <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">{sebutTanggalPanjang(r.tanggal)}</td>
                    <td className={r.batal ? "px-2 py-1.5 text-muted-foreground line-through" : "px-2 py-1.5"}>{r.nama}</td>
                    <td className="px-2 py-1.5 text-xs">{SEBUT_JENIS[r.jenis] ?? r.jenis}</td>
                    <td className="px-2 py-1.5 text-xs text-muted-foreground">{r.asal}</td>
                    {bolehUbah ? (
                      <td className="px-2 py-1.5 text-right">
                        {r.asal === "SKB" && !dihapus.has(r.tanggal) ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setTambahan((x) => [...x, { tanggal: r.tanggal, nama: r.nama, jenis: r.jenis as JenisLibur, aksi: "hapus" as const }])}
                          >
                            Batalkan
                          </Button>
                        ) : r.asal !== "SKB" ? (
                          <Button size="sm" variant="ghost" onClick={() => setTambahan((x) => x.filter((t) => t.tanggal !== r.tanggal))}>
                            {r.batal ? "Pulihkan" : "Hapus"}
                          </Button>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {bolehUbah ? (
          <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
            <label className="grid gap-1 text-xs text-muted-foreground">
              Tanggal
              <Input type="date" value={baru.tanggal} onChange={(e) => setBaru((x) => ({ ...x, tanggal: e.target.value }))} className="h-9 w-44" />
            </label>
            <label className="grid min-w-[12rem] flex-1 gap-1 text-xs text-muted-foreground">
              Nama hari libur
              <Input value={baru.nama} placeholder="mis. HUT Kabupaten Donggala" onChange={(e) => setBaru((x) => ({ ...x, nama: e.target.value }))} className="h-9" />
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              Jenis
              <NativeSelect value={baru.jenis} onChange={(e) => setBaru((x) => ({ ...x, jenis: e.target.value as JenisLibur }))}>
                <option value="daerah">Libur daerah</option>
                <option value="cuti-bersama">Cuti bersama</option>
                <option value="nasional">Libur nasional</option>
                <option value="lain">Lainnya</option>
              </NativeSelect>
            </label>
            <Button variant="outline" onClick={tambahBaris}>
              Tambahkan
            </Button>
            <Button onClick={() => void simpan()} disabled={!berubah || sibuk}>
              {sibuk ? "Menyimpan…" : "Simpan"}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Hanya Super Admin dan Admin yang dapat mengubah daftar ini.</p>
        )}

        {pesan ? (
          <p role={pesan.jenis === "galat" ? "alert" : "status"} className={pesan.jenis === "galat" ? "text-sm text-red-600" : "text-sm text-emerald-700"}>
            {pesan.teks}
          </p>
        ) : null}
        {data?.diubahOleh ? (
          <p className="text-xs text-muted-foreground">
            Terakhir diubah {data.diubahOleh}
            {data.diubahPada ? `, ${new Date(data.diubahPada).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}` : ""}.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
