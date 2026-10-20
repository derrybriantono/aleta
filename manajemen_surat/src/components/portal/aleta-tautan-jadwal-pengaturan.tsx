"use client";

/**
 * Pengaturan "Tautan Jadwal Sidang" (20 Okt 2026) - Super Admin dan Admin.
 *
 * Membuat, mencabut, dan mematikan tautan rahasia untuk Jadwal Sidang tanpa
 * akun (/jadwal/<rahasia>). Rahasia asli HANYA tampak sekali, tepat setelah
 * dibuat - di basis data yang tersimpan hanya hash-nya, jadi tidak ada tombol
 * "salin" untuk tautan lama; tautan yang hilang dicabut dan dibuat baru.
 */

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiPath, withBasePath } from "@/lib/base-path";
import { ALAMAT_JADWAL_TAMPIL } from "@/lib/jadwal-tampil-url";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";

type Tautan = {
  id: string;
  nama: string;
  kode: string;
  bertindakSebagaiNama: string;
  berlakuSampai: string;
  dicabutPada: string;
  keadaan: "aktif" | "dicabut" | "kedaluwarsa";
  dibuatNama: string;
  dibuatPada: string;
  terakhirDipakai: string;
  terakhirIp: string;
  jumlahPakai: number;
  aksiSejamTerakhir: number;
};
type Calon = { id: string; nama: string; golongan: string };
type Jejak = { id: string; tautan_nama: string; ip: string; waktu: string; aksi: string; perkara: string };
type Halaman = { tautan: Tautan[]; calon: Calon[]; mati: boolean; batasAksiPerJam: number };

const SEBUTAN_GOLONGAN: Record<string, string> = { pp: "Panitera Pengganti", panitera: "Panitera", panmud: "Panitera Muda" };

function waktuBaca(iso: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

async function salin(teks: string) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(teks);
      return true;
    }
  } catch {
    /* cara lama di bawah */
  }
  try {
    const kotak = document.createElement("textarea");
    kotak.value = teks;
    kotak.setAttribute("readonly", "");
    kotak.style.position = "fixed";
    kotak.style.opacity = "0";
    document.body.appendChild(kotak);
    kotak.select();
    const berhasil = document.execCommand("copy");
    document.body.removeChild(kotak);
    return berhasil;
  } catch {
    return false;
  }
}

export function AletaTautanJadwalPengaturan({ bolehUbah }: { bolehUbah: boolean }) {
  const [halaman, setHalaman] = useState<Halaman | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [kabar, setKabar] = useState("");
  const [nama, setNama] = useState("");
  const [wakil, setWakil] = useState("");
  const [berakhir, setBerakhir] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [baru, setBaru] = useState<{ nama: string; alamat: string } | null>(null);
  const [disalin, setDisalin] = useState(false);
  const [jejak, setJejak] = useState<Jejak[] | null>(null);

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const jawaban = await fetch(apiPath("/api/aleta-ecourt/tautan-jadwal"), { cache: "no-store" });
      const isi = await jawaban.json();
      if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Tautan jadwal sidang belum dapat dibaca."));
      setHalaman((isi?.data ?? isi) as Halaman);
      setKabar("");
    } catch (galat) {
      setKabar(galat instanceof Error ? galat.message : "Tautan jadwal sidang belum dapat dibaca.");
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    const pengatur = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(pengatur);
  }, [muat]);

  const kirim = async (badan: Record<string, unknown>) => {
    const jawaban = await fetch(apiPath("/api/aleta-ecourt/tautan-jadwal"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(badan),
    });
    const isi = await jawaban.json();
    if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Permintaan belum dapat dilaksanakan."));
    return (isi?.data ?? isi) as Record<string, unknown>;
  };

  const buat = async () => {
    setSibuk(true);
    setKabar("");
    try {
      const hasil = await kirim({ aksi: "buat", nama, bertindakSebagai: wakil, berlakuSampai: berakhir });
      const alamat = `${window.location.origin}${withBasePath(`${ALAMAT_JADWAL_TAMPIL}/${String(hasil.rahasia)}`)}`;
      setBaru({ nama: String(hasil.nama), alamat });
      setDisalin(false);
      setNama("");
      setBerakhir("");
      await muat();
    } catch (galat) {
      setKabar(galat instanceof Error ? galat.message : "Tautan belum dapat dibuat.");
    } finally {
      setSibuk(false);
    }
  };

  const cabut = async (t: Tautan) => {
    if (!window.confirm(`Cabut tautan "${t.nama}"? Layar yang memakainya langsung berhenti.`)) return;
    try {
      await kirim({ aksi: "cabut", id: t.id });
      await muat();
    } catch (galat) {
      setKabar(galat instanceof Error ? galat.message : "Tautan belum dapat dicabut.");
    }
  };

  const ubahSaklar = async (mati: boolean) => {
    try {
      await kirim({ aksi: "saklar", mati });
      await muat();
    } catch (galat) {
      setKabar(galat instanceof Error ? galat.message : "Saklar belum dapat diubah.");
    }
  };

  const bukaJejak = async () => {
    if (jejak) {
      setJejak(null);
      return;
    }
    try {
      const jawaban = await fetch(apiPath("/api/aleta-ecourt/tautan-jadwal?bagian=jejak"), { cache: "no-store" });
      const isi = await jawaban.json();
      if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Jejak belum dapat dibaca."));
      setJejak(((isi?.data ?? isi) as { jejak: Jejak[] }).jejak);
    } catch (galat) {
      setKabar(galat instanceof Error ? galat.message : "Jejak belum dapat dibaca.");
    }
  };

  return (
    <Card data-tautan-jadwal-pengaturan="">
      <CardHeader>
        <CardTitle>Tautan Jadwal Sidang</CardTitle>
        <CardDescription>
          Jadwal Sidang yang dibuka lewat alamat, tanpa masuk akun - untuk layar di meja panitera pengganti atau di
          ruang sidang. Tombol tunda | putus tetap mencatat ke SIPP atas panitera pengganti perkara itu, siapa pun yang
          menekannya. Hanya dari jaringan kantor; tiap tindakan menulis tercatat dengan nama tautan dan alamat IP.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {kabar ? (
          <p role="alert" className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
            {kabar}
          </p>
        ) : null}

        {halaman ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2">
            <p className="text-sm">
              {halaman.mati ? (
                <strong className="text-rose-700 dark:text-rose-300">Semua tautan sedang DIMATIKAN.</strong>
              ) : (
                <>Tautan menyala. Batas {halaman.batasAksiPerJam} tindakan menulis per jam untuk tiap tautan.</>
              )}
            </p>
            {bolehUbah ? (
              <Button size="sm" variant={halaman.mati ? "default" : "outline"} onClick={() => void ubahSaklar(!halaman.mati)}>
                {halaman.mati ? "Nyalakan semua tautan" : "Matikan semua tautan"}
              </Button>
            ) : null}
          </div>
        ) : null}

        {baru ? (
          <div className="space-y-2 rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100" data-tautan-baru="">
            <p className="font-semibold">Tautan &quot;{baru.nama}&quot; dibuat. Salin SEKARANG - alamat lengkap ini tidak akan tampil lagi.</p>
            <div className="flex flex-wrap items-center gap-2">
              <Input readOnly value={baru.alamat} onFocus={(e) => e.currentTarget.select()} className="min-w-[18rem] flex-1 font-mono text-xs" aria-label="Alamat tautan" />
              <Button
                size="sm"
                onClick={async () => setDisalin(await salin(baru.alamat))}
              >
                {disalin ? "Tersalin" : "Salin"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setBaru(null)}>
                Sudah saya simpan
              </Button>
            </div>
            <p className="text-xs">Tambahkan ?tanggal=2026-10-21, &amp;ruang=1, atau &amp;majelis=A di ujung alamat bila perlu. Siapa pun yang memegang alamat ini di jaringan kantor dapat mencatat tunda | putus - simpan seperti kata sandi.</p>
          </div>
        ) : null}

        {bolehUbah ? (
          <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1 text-xs">
              <span className="font-medium">Nama tautan</span>
              <Input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Meja PP Ruang 1" maxLength={80} />
            </label>
            <label className="space-y-1 text-xs">
              <span className="font-medium">Mewakili akun</span>
              <select
                value={wakil}
                onChange={(e) => setWakil(e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value="">Pilih panitera pengganti / panitera</option>
                {(halaman?.calon ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nama} ({SEBUTAN_GOLONGAN[c.golongan] ?? c.golongan})
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs">
              <span className="font-medium">Berlaku sampai (opsional)</span>
              <Input type="date" value={berakhir} onChange={(e) => setBerakhir(e.target.value)} />
            </label>
            <div className="flex items-end">
              <Button disabled={sibuk || !nama.trim() || !wakil} onClick={() => void buat()}>
                {sibuk ? "Membuat…" : "Buat tautan"}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2">Nama</th>
                <th className="px-3 py-2">Mewakili</th>
                <th className="px-3 py-2">Keadaan</th>
                <th className="px-3 py-2">Dipakai terakhir</th>
                <th className="px-3 py-2 text-right">Tindakan/jam</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {memuat && !halaman ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                    Memuat…
                  </td>
                </tr>
              ) : (halaman?.tautan ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                    Belum ada tautan.
                  </td>
                </tr>
              ) : (
                (halaman?.tautan ?? []).map((t) => (
                  <tr key={t.id} className="border-t align-top">
                    <td className="px-3 py-2">
                      <p className="font-medium">{t.nama}</p>
                      <p className="text-xs text-muted-foreground">kode {t.kode} · dibuat {waktuBaca(t.dibuatPada)} oleh {t.dibuatNama || "-"}</p>
                    </td>
                    <td className="px-3 py-2">{t.bertindakSebagaiNama}</td>
                    <td className="px-3 py-2">
                      <Badge variant={t.keadaan === "aktif" ? "success" : "muted"}>
                        {t.keadaan === "aktif" ? "Aktif" : t.keadaan === "dicabut" ? "Dicabut" : "Kedaluwarsa"}
                      </Badge>
                      {t.berlakuSampai ? <p className="mt-1 text-xs text-muted-foreground">sampai {waktuBaca(t.berlakuSampai)}</p> : null}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {waktuBaca(t.terakhirDipakai)}
                      {t.terakhirIp ? <span className="block text-muted-foreground">{t.terakhirIp} · {t.jumlahPakai}x dibuka</span> : null}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{t.aksiSejamTerakhir}</td>
                    <td className="px-3 py-2 text-right">
                      {bolehUbah && t.keadaan === "aktif" ? (
                        <Button size="sm" variant="outline" onClick={() => void cabut(t)}>
                          Cabut
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div>
          <Button size="sm" variant="ghost" onClick={() => void bukaJejak()}>
            {jejak ? "Tutup jejak" : "Lihat jejak tindakan"}
          </Button>
          {jejak ? (
            <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto text-xs" data-jejak-tautan="">
              {jejak.length === 0 ? <li className="text-muted-foreground">Belum ada tindakan menulis lewat tautan.</li> : null}
              {jejak.map((j) => (
                <li key={j.id} className="rounded border px-2 py-1">
                  <strong>{waktuBaca(j.waktu)}</strong> · tautan jadwal: {j.tautan_nama} · {j.ip || "IP tidak terbaca"} · {j.aksi}
                  {j.perkara ? ` · ${j.perkara}` : ""}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
