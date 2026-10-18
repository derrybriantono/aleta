"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { apiPath } from "@/lib/base-path";
import type { ButirPeta, KelompokPeta, PerubahanHak, TingkatPeta } from "@/lib/hak-akses-peta";
import { golonganPengguna, type GolonganPeran } from "@/lib/matriks-peran";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
import type { UserPersona } from "@/lib/types";

/**
 * Pengaturan > Hak akses per peran (18 Okt 2026).
 *
 * Data dari GET /api/hak-akses/peta - SAMA dengan dokumen MATRIKS-HAK-AKSES-18okt.md
 * (lib/hak-akses-peta.ts). Admin membaca tabelnya; Super Admin juga mendapat kunci, rute,
 * dan daftar perubahan. Dua cara baca: "Per peran" (daftar tugas satu peran, nyaman di
 * HP dan layar TV) dan "Tabel lengkap" (semua peran berdampingan, digulir ke samping).
 */

type Golongan = { kode: string; label: string };
type Kelompok = { kode: KelompokPeta; label: string };
type Kewenangan = { judul: string; isi: string };
type Menunggu = { judul: string; keadaan: string; usul: string };
type Disetujui = { nomor: number; judul: string; isi: string };
type FolderAbt = { folder: string; tahap: string; grup: string[]; validator: string[] };
type Peta = {
  teknis: boolean;
  golongan: Golongan[];
  kelompok: Kelompok[];
  tingkat: Record<TingkatPeta, string>;
  butir: ButirPeta[];
  kewenangan: Kewenangan[];
  perubahan: PerubahanHak[];
  menunggu: Menunggu[];
  disetujui: Disetujui[];
  hakMenuAbt: FolderAbt[];
};

const WARNA_TINGKAT: Record<TingkatPeta, "muted" | "info" | "success"> = { L: "muted", P: "info", U: "success" };
const URUTAN: readonly TingkatPeta[] = ["L", "P", "U"];

/** Tingkat tertinggi di antara golongan terpilih (seorang pegawai dapat memegang beberapa golongan sekaligus). */
function tingkatGabungan(b: ButirPeta, golongan: readonly string[]): TingkatPeta | undefined {
  let t = -1;
  for (const g of golongan) {
    const v = b.hak[g as GolonganPeran];
    if (v) t = Math.max(t, URUTAN.indexOf(v));
  }
  return t < 0 ? undefined : URUTAN[t];
}

function Tingkat({ nilai, label }: { nilai: TingkatPeta | undefined; label: Record<TingkatPeta, string> }) {
  if (!nilai) return <span className="text-muted-foreground" aria-label="Tidak diberi">-</span>;
  return <Badge variant={WARNA_TINGKAT[nilai]}>{label[nilai]}</Badge>;
}

async function muat(): Promise<Peta> {
  const r = await fetch(apiPath("/api/hak-akses/peta"), { cache: "no-store" });
  const isi = (await r.json().catch(() => null)) as { ok?: boolean; data?: Peta } | null;
  if (!r.ok || !isi || isi.ok === false || !isi.data) throw new Error(pesanGalatPortal(isi, `Peta hak akses tidak terbaca (HTTP ${r.status}).`));
  return isi.data;
}

export function HakAksesPeran({ pengguna = [] }: { pengguna?: UserPersona[] }) {
  const [peta, setPeta] = useState<Peta | null>(null);
  const [galat, setGalat] = useState("");
  const [cara, setCara] = useState<"peran" | "akun" | "tabel">("peran");
  const [peran, setPeran] = useState("hakim");
  const [akunId, setAkunId] = useState("");
  const [kelompok, setKelompok] = useState<string>("semua");
  const [cari, setCari] = useState("");

  useEffect(() => {
    let batal = false;
    muat()
      .then((p) => {
        if (batal) return;
        setPeta(p);
        if (!p.golongan.some((g) => g.kode === "hakim") && p.golongan[0]) setPeran(p.golongan[0].kode);
      })
      .catch((e: Error) => !batal && setGalat(e.message));
    return () => {
      batal = true;
    };
  }, []);

  const butirTersaring = useMemo(() => {
    if (!peta) return [];
    const kata = cari.trim().toLowerCase();
    return peta.butir.filter((b) => {
      if (kelompok !== "semua" && b.kelompok !== kelompok) return false;
      if (!kata) return true;
      return `${b.judul} ${b.keterangan} ${b.catatan ?? ""}`.toLowerCase().includes(kata);
    });
  }, [peta, kelompok, cari]);

  if (galat) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-rose-700 dark:text-rose-300" role="alert">
          {galat}
        </CardContent>
      </Card>
    );
  }
  if (!peta) return <p className="p-6 text-sm text-muted-foreground">Memuat peta hak akses...</p>;

  const akunAktif = pengguna.filter((u) => u.isActive !== false).sort((a, b) => String(a.name).localeCompare(String(b.name), "id"));
  const akun = akunAktif.find((u) => u.id === akunId) ?? null;
  const golonganAkun = akun ? golonganPengguna(akun) : [];
  const golonganTerpilih: string[] = cara === "akun" ? golonganAkun : [peran];
  const labelGolongan = (kode: string) => peta.golongan.find((g) => g.kode === kode)?.label ?? kode;
  const labelPeran =
    cara === "akun"
      ? akun
        ? `${akun.name} (${golonganAkun.map(labelGolongan).join(" + ") || "tanpa golongan"})`
        : "akun yang dipilih"
      : labelGolongan(peran);
  const perKelompok = peta.kelompok
    .map((k) => ({ ...k, butir: butirTersaring.filter((b) => b.kelompok === k.kode) }))
    .filter((k) => k.butir.length > 0);

  return (
    <div className="space-y-6" data-hak-akses-peran>
      <Card>
        <CardHeader>
          <CardTitle>Siapa boleh apa</CardTitle>
          <CardDescription>
            Lihat = membaca saja. Pakai = menjalankan fitur dalam tugasnya. Ubah = mengubah data atau pengaturan satker, atau menulis hasil
            substantif. Tanda minus = tidak diberi (menu tidak tampil dan server menolak). Super Admin memegang dan melihat semuanya.
            {peta.teknis ? "" : " Halaman ini hanya dapat dibaca; perubahan hak dilakukan Super Admin."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="flex gap-2" role="group" aria-label="Cara membaca">
            <Button type="button" variant={cara === "peran" ? "default" : "outline"} onClick={() => setCara("peran")}>
              Per peran
            </Button>
            {pengguna.length > 0 ? (
              <Button type="button" variant={cara === "akun" ? "default" : "outline"} onClick={() => setCara("akun")}>
                Per akun
              </Button>
            ) : null}
            <Button type="button" variant={cara === "tabel" ? "default" : "outline"} onClick={() => setCara("tabel")}>
              Tabel lengkap
            </Button>
          </div>
          {cara === "akun" ? (
            <label className="space-y-1 text-sm">
              <span className="block text-muted-foreground">Akun</span>
              <NativeSelect aria-label="Pilih akun" value={akunId} onChange={(e) => setAkunId(e.target.value)} className="w-72">
                <option value="">Pilih akun...</option>
                {akunAktif.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </NativeSelect>
            </label>
          ) : null}
          {cara === "peran" ? (
            <label className="space-y-1 text-sm">
              <span className="block text-muted-foreground">Peran</span>
              <NativeSelect aria-label="Pilih peran" value={peran} onChange={(e) => setPeran(e.target.value)} className="w-64">
                {peta.golongan.map((g) => (
                  <option key={g.kode} value={g.kode}>
                    {g.label}
                  </option>
                ))}
              </NativeSelect>
            </label>
          ) : null}
          <label className="space-y-1 text-sm">
            <span className="block text-muted-foreground">Kelompok</span>
            <NativeSelect aria-label="Pilih kelompok" value={kelompok} onChange={(e) => setKelompok(e.target.value)} className="w-72">
              <option value="semua">Semua kelompok</option>
              {peta.kelompok.map((k) => (
                <option key={k.kode} value={k.kode}>
                  {k.label}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="min-w-56 flex-1 space-y-1 text-sm">
            <span className="block text-muted-foreground">Cari fitur</span>
            <Input aria-label="Cari fitur" value={cari} onChange={(e) => setCari(e.target.value)} placeholder="mis. BAS, kasir, relaas" />
          </label>
        </CardContent>
      </Card>

      {cara === "peran" || cara === "akun" ? (
        <div className="space-y-4" data-hak-akses-cara="peran">
          <p className="text-sm text-muted-foreground">
            {cara === "akun" && !akun ? (
              "Pilih akun untuk melihat hak gabungan dari jabatan dan peran tambahannya."
            ) : (
              <>
                Yang dapat dilakukan <strong className="text-foreground">{labelPeran}</strong>
                {golonganTerpilih.includes("super-admin") ? " (semuanya)" : ""}. Fitur yang tidak tercantum di bawah tidak diberikan kepadanya.
                {cara === "akun" ? " Peran tambahan hanya menambah hak, tidak pernah mencabut." : ""}
              </>
            )}
          </p>
          {perKelompok.map((k) => {
            const baris = k.butir.filter((b) => tingkatGabungan(b, golonganTerpilih));
            if (baris.length === 0) return null;
            return (
              <Card key={k.kode}>
                <CardHeader>
                  <CardTitle className="text-base">{k.label}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {baris.map((b) => (
                    <div key={b.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-muted/30 p-3" data-butir={b.id}>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="font-medium text-foreground">{b.judul}</p>
                        <p className="text-sm text-muted-foreground">{b.keterangan}</p>
                        {b.catatan ? <p className="text-sm text-amber-700 dark:text-amber-300">{b.catatan}</p> : null}
                        {peta.teknis && (b.sumber || b.rute) ? <Teknis b={b} /> : null}
                      </div>
                      <Tingkat nilai={tingkatGabungan(b, golonganTerpilih)} label={peta.tingkat} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card data-hak-akses-cara="tabel">
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[1400px] border-collapse text-sm">
              <thead>
                <tr className="bg-muted/60">
                  <th className="sticky left-0 z-10 w-80 bg-muted p-2 text-left">Fitur</th>
                  {peta.golongan.map((g) => (
                    <th key={g.kode} className="p-2 text-center text-xs font-medium" scope="col">
                      {g.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {perKelompok.map((k) => (
                  <TabelKelompok key={k.kode} kelompok={k} golongan={peta.golongan} tingkat={peta.tingkat} teknis={peta.teknis} />
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Kewenangan khusus</CardTitle>
          <CardDescription>Aturan di luar tabel: atas akun siapa sesuatu ditulis, siapa yang memeriksa, dan syarat tambahan.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-2">
          {peta.kewenangan.map((k) => (
            <div key={k.judul} className="rounded-xl border border-border bg-muted/30 p-3">
              <p className="font-medium text-foreground">{k.judul}</p>
              <p className="text-sm text-muted-foreground">{k.isi}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card data-hak-akses-abt>
        <CardHeader>
          <CardTitle>Hak menu ABT per folder</CardTitle>
          <CardDescription>
            Kelompok pengguna SIPP yang dapat membuka tiap folder blangko ABT. Folder terbuka bila tahap perkara di SIPP dan jenis perkara cocok; Super
            Admin melewati cek tahap. Dibaca dari salinan lokal ABT; yang berjalan di server dapat berbeda sampai paketnya dipasang.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {peta.hakMenuAbt.map((h) => (
            <div key={h.folder} className="rounded-xl border border-border bg-muted/30 p-3 text-sm">
              <p className="font-medium text-foreground">{h.folder}</p>
              <p className="text-muted-foreground">Tahap SIPP: {h.tahap}</p>
              <p className="text-muted-foreground">Dibuka oleh: {h.grup.join(", ")}</p>
              {h.validator.length ? <p className="text-muted-foreground">Acc atau pemeriksa: {h.validator.join(", ")}</p> : null}
            </div>
          ))}
        </CardContent>
      </Card>

      {peta.teknis && (peta.disetujui ?? []).length > 0 ? (
        <Card data-hak-akses-disetujui>
          <CardHeader>
            <CardTitle>Keputusan yang sudah berlaku</CardTitle>
            <CardDescription>Jawaban Anda atas usulan hak akses 18 Oktober 2026.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {peta.disetujui.map((d) => (
              <div key={d.nomor} className="rounded-xl border border-border bg-muted/30 p-3 text-sm">
                <p className="font-medium text-foreground">
                  {d.nomor} - {d.judul}
                </p>
                <p className="text-muted-foreground">{d.isi}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {peta.teknis && peta.menunggu.length > 0 ? (
        <Card data-hak-akses-menunggu>
          <CardHeader>
            <CardTitle>Menunggu keputusan Anda</CardTitle>
            <CardDescription>Hal yang belum pernah diputuskan; sementara berlaku keadaan di bawah.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {peta.menunggu.map((m) => (
              <div key={m.judul} className="space-y-1 rounded-xl border border-border bg-muted/30 p-3">
                <p className="font-medium text-foreground">{m.judul}</p>
                <p className="text-sm text-muted-foreground">Keadaan: {m.keadaan}</p>
                <p className="text-sm text-muted-foreground">Usul: {m.usul}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {peta.teknis && peta.perubahan.length > 0 ? (
        <Card data-hak-akses-perubahan>
          <CardHeader>
            <CardTitle>Perubahan hak 18 Okt 2026</CardTitle>
            <CardDescription>Sebelum, sesudah, dan alasannya. Butir bertanda &quot;Pilihan baru&quot; belum pernah diputuskan pengguna dan menunggu konfirmasi.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {peta.perubahan.map((p) => (
              <div key={p.judul} className="space-y-1 rounded-xl border border-border bg-muted/30 p-3">
                <div className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                  {p.judul}
                  <Badge variant={p.keputusan === "baru" ? "warning" : "success"}>{p.keputusan === "baru" ? "Pilihan baru" : "Sesuai keputusan"}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">Sebelum: {p.sebelum}</p>
                <p className="text-sm text-muted-foreground">Sesudah: {p.sesudah}</p>
                <p className="text-sm text-muted-foreground">Alasan: {p.alasan}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Teknis({ b }: { b: ButirPeta }) {
  return (
    <details className="text-xs text-muted-foreground">
      <summary className="cursor-pointer">Rincian teknis (Super Admin)</summary>
      {b.sumber ? <p>Sumber: {b.sumber}</p> : null}
      {b.rute?.length ? <p>Rute: {b.rute.join(", ")}</p> : null}
    </details>
  );
}

function TabelKelompok({
  kelompok,
  golongan,
  tingkat,
  teknis,
}: {
  kelompok: { kode: string; label: string; butir: ButirPeta[] };
  golongan: Golongan[];
  tingkat: Record<TingkatPeta, string>;
  teknis: boolean;
}) {
  return (
    <>
      <tr>
        <th colSpan={golongan.length + 1} className="bg-muted/80 p-2 text-left text-sm font-semibold" scope="colgroup">
          {kelompok.label}
        </th>
      </tr>
      {kelompok.butir.map((b) => (
        <tr key={b.id} className="border-t border-border align-top" data-butir={b.id}>
          <td className="sticky left-0 z-10 bg-card p-2">
            <p className="font-medium text-foreground">{b.judul}</p>
            {b.catatan ? <p className="text-xs text-muted-foreground">{b.catatan}</p> : null}
            {teknis && (b.sumber || b.rute) ? <Teknis b={b} /> : null}
          </td>
          {golongan.map((g) => (
            <td key={g.kode} className="p-2 text-center" data-golongan={g.kode}>
              <Tingkat nilai={b.hak[g.kode as keyof typeof b.hak]} label={tingkat} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
