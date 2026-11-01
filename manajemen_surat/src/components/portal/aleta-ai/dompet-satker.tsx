"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, CircleAlert, Loader2, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { ambil, kirimJson } from "@/lib/aleta-ai/klien";
import { formatRupiah } from "@/lib/aleta-ai/kontrak";

/**
 * Dompet satker (Pengaturan ALETA Ai, hanya Super Admin): isi saldo, aturan siapa boleh memakainya (per peran / per pengguna,
 * dengan batas bulanan), pemakaian bulan ini, dan riwayat isi serta pemakaian (siapa, kapan, berapa). Angka dari server
 * (/api/aleta-ai/satker); layar hanya menampilkan dan mengirim perubahan.
 */

type Aturan = { sasaran: "peran" | "pengguna"; sasaranId: string; boleh: boolean; batasBulananRp: number };
type Mutasi = { id: string; jenis: string; jumlahRp: number; saldoSetelah: number; penggunaId: string; peranId: string; olehId: string; catatan: string; waktu: string };
type Pemakaian = { penggunaId: string; peranId: string; terpakaiRp: number };
type Data = { saldoRp: number; seimbang: boolean; aturan: Aturan[]; riwayat: Mutasi[]; pemakaianBulanIni: Pemakaian[] };

const LABEL_JENIS: Record<string, string> = { isi: "Isi saldo", potong: "Pemakaian", koreksi: "Koreksi" };

const waktuIndo = (iso: string) => {
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? iso : t.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
};

function Pesan({ teks, baik }: { teks: string; baik: boolean }) {
  if (!teks) return null;
  return (
    <p
      role="status"
      className={`flex items-start gap-2 break-words rounded-md border px-3 py-2 text-sm ${
        baik ? "border-emerald-300/70 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" : "border-amber-300/70 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
      }`}
    >
      {baik ? <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
      <span className="min-w-0">{teks}</span>
    </p>
  );
}

export function KartuDompetSatker({ pengguna, peran }: { pengguna: Array<{ id: string; name: string }>; peran: Array<{ id: string; name: string }> }) {
  const [data, setData] = useState<Data | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [jumlah, setJumlah] = useState("");
  const [catatan, setCatatan] = useState("");
  const [pesanIsi, setPesanIsi] = useState({ teks: "", baik: true });
  const [sasaran, setSasaran] = useState<"peran" | "pengguna">("peran");
  const [sasaranId, setSasaranId] = useState("");
  const [boleh, setBoleh] = useState(true);
  const [batas, setBatas] = useState("0");
  const [pesanAturan, setPesanAturan] = useState({ teks: "", baik: true });

  const namaPengguna = useMemo(() => new Map(pengguna.map((p) => [p.id, p.name])), [pengguna]);
  const namaPeran = useMemo(() => new Map(peran.map((p) => [p.id, p.name])), [peran]);
  const nama = (id: string) => (id ? namaPengguna.get(id) ?? id : "-");

  const terapkan = useCallback((r: Awaited<ReturnType<typeof ambil<Data>>>) => {
    if (r.ok) {
      const d = (r.data ?? {}) as Partial<Data>;
      setData({
        saldoRp: Number(d.saldoRp) || 0,
        seimbang: d.seimbang !== false,
        aturan: Array.isArray(d.aturan) ? d.aturan : [],
        riwayat: Array.isArray(d.riwayat) ? d.riwayat : [],
        pemakaianBulanIni: Array.isArray(d.pemakaianBulanIni) ? d.pemakaianBulanIni : [],
      });
      setGalat("");
    } else setGalat(r.galat);
    setMemuat(false);
  }, []);

  const muat = useCallback(async () => {
    terapkan(await ambil<Data>("/api/aleta-ai/satker"));
  }, [terapkan]);

  useEffect(() => {
    let batal = false;
    void ambil<Data>("/api/aleta-ai/satker").then((r) => {
      if (!batal) terapkan(r);
    });
    return () => {
      batal = true;
    };
  }, [terapkan]);

  async function isi() {
    const r = await kirimJson<{ saldoRp: number }>("/api/aleta-ai/satker", "POST", { jumlahRp: Number(jumlah), catatan });
    if (!r.ok) return setPesanIsi({ teks: r.galat, baik: false });
    setPesanIsi({ teks: `Saldo satker terisi. Saldo sekarang ${formatRupiah(r.data.saldoRp)}.`, baik: true });
    setJumlah("");
    setCatatan("");
    await muat();
  }

  async function simpanAturan() {
    const r = await kirimJson<Aturan[]>("/api/aleta-ai/satker", "PUT", { sasaran, sasaranId, boleh, batasBulananRp: Number(batas) || 0 });
    if (!r.ok) return setPesanAturan({ teks: r.galat, baik: false });
    setPesanAturan({ teks: "Aturan tersimpan.", baik: true });
    await muat();
  }

  async function hapusAturan(a: Aturan) {
    const r = await ambil<Aturan[]>(`/api/aleta-ai/satker?sasaran=${encodeURIComponent(a.sasaran)}&sasaranId=${encodeURIComponent(a.sasaranId)}`, { method: "DELETE" });
    if (!r.ok) return setPesanAturan({ teks: r.galat, baik: false });
    setPesanAturan({ teks: "Aturan dihapus.", baik: true });
    await muat();
  }

  const pilihan = sasaran === "peran" ? peran : pengguna;
  const namaSasaran = (a: Aturan) => (a.sasaran === "peran" ? namaPeran.get(a.sasaranId) ?? a.sasaranId : nama(a.sasaranId));

  return (
    <Card className="border-border/80" id="dompet-satker" data-testid="dompet-satker">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Dompet satker</CardTitle>
        <CardDescription>
          Saldo bersama yang dapat dipakai pengguna menurut aturan di bawah. Pengguna memilihnya dengan mengklik saldo di panel; bila saldo satker habis, pemakaian dari dompet satker terkunci dan saldo pribadi tetap bisa dipakai. Bawaannya semua peran boleh memakainya tanpa batas bulanan; tambahkan aturan untuk membatasi atau melarang.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {memuat && !data ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Memuat dompet satker…
          </p>
        ) : null}
        {galat ? <Pesan teks={galat} baik={false} /> : null}
        {data ? (
          <>
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-muted/30 px-4 py-3">
              <div>
                <p className="text-xs text-muted-foreground">Saldo satker</p>
                <p className="text-2xl font-semibold" data-testid="saldo-satker">{formatRupiah(data.saldoRp)}</p>
              </div>
              {data.seimbang ? <Badge variant="success">Cocok dengan buku mutasi</Badge> : <Badge variant="danger">Tidak cocok dengan buku mutasi</Badge>}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Isi saldo satker</h3>
              <div className="flex flex-wrap items-end gap-2">
                <label className="space-y-1.5 text-sm font-medium">
                  Jumlah isi saldo satker (Rp)
                  <Input type="number" inputMode="numeric" min={1} step="10000" value={jumlah} className="w-44" onChange={(e) => setJumlah(e.target.value)} />
                </label>
                <label className="min-w-0 flex-1 space-y-1.5 text-sm font-medium basis-56">
                  Catatan isi satker (boleh kosong)
                  <Input value={catatan} onChange={(e) => setCatatan(e.target.value)} />
                </label>
                <Button onClick={() => void isi()} disabled={!(Number(jumlah) > 0)}>
                  Isi saldo satker
                </Button>
              </div>
              <Pesan teks={pesanIsi.teks} baik={pesanIsi.baik} />
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Aturan pemakaian</h3>
              <p className="text-xs text-muted-foreground">Aturan untuk satu pengguna mengalahkan aturan peran. Peran atau pengguna tanpa aturan memakai bawaan (boleh, tanpa batas). Batas bulanan berlaku untuk tiap pengguna (0 = tanpa batas).</p>
              {data.aturan.length ? (
                <ul className="space-y-1.5" data-testid="aturan-satker">
                  {data.aturan.map((a) => (
                    <li key={`${a.sasaran}:${a.sasaranId}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm">
                      <Badge variant="outline">{a.sasaran === "peran" ? "Peran" : "Pengguna"}</Badge>
                      <span className="font-medium">{namaSasaran(a)}</span>
                      <span>{a.boleh ? "boleh memakai" : "tidak boleh memakai"}</span>
                      {a.boleh ? <span className="text-muted-foreground">{a.batasBulananRp > 0 ? `batas ${formatRupiah(a.batasBulananRp)} per bulan` : "tanpa batas bulanan"}</span> : null}
                      <Button variant="ghost" size="sm" className="ml-auto" aria-label={`Hapus aturan ${namaSasaran(a)}`} onClick={() => void hapusAturan(a)}>
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Belum ada aturan khusus: semua peran boleh memakai dompet satker tanpa batas bulanan.</p>
              )}
              <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-border/70 p-3">
                <label className="space-y-1.5 text-sm font-medium">
                  Berlaku untuk
                  <NativeSelect
                    className="h-9 w-36"
                    value={sasaran}
                    onChange={(e) => {
                      setSasaran(e.target.value as "peran" | "pengguna");
                      setSasaranId("");
                    }}
                  >
                    <option value="peran">Satu peran</option>
                    <option value="pengguna">Satu pengguna</option>
                  </NativeSelect>
                </label>
                <label className="min-w-0 space-y-1.5 text-sm font-medium basis-52">
                  {sasaran === "peran" ? "Peran" : "Pengguna"}
                  <NativeSelect className="h-9" value={sasaranId} onChange={(e) => setSasaranId(e.target.value)}>
                    <option value="">Pilih…</option>
                    {pilihan.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </NativeSelect>
                </label>
                <label className="space-y-1.5 text-sm font-medium">
                  Hak
                  <NativeSelect className="h-9 w-40" value={boleh ? "ya" : "tidak"} onChange={(e) => setBoleh(e.target.value === "ya")}>
                    <option value="ya">Boleh memakai</option>
                    <option value="tidak">Tidak boleh</option>
                  </NativeSelect>
                </label>
                <label className="space-y-1.5 text-sm font-medium">
                  Batas per bulan (Rp)
                  <Input type="number" inputMode="numeric" min={0} step="10000" value={batas} className="w-40" disabled={!boleh} onChange={(e) => setBatas(e.target.value)} />
                </label>
                <Button onClick={() => void simpanAturan()} disabled={!sasaranId}>
                  Simpan aturan
                </Button>
              </div>
              <Pesan teks={pesanAturan.teks} baik={pesanAturan.baik} />
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Pemakaian bulan ini</h3>
              {data.pemakaianBulanIni.length ? (
                <ul className="space-y-1 text-sm" data-testid="pemakaian-satker">
                  {data.pemakaianBulanIni.map((p) => (
                    <li key={p.penggunaId} className="flex flex-wrap justify-between gap-2 border-b border-border/50 py-1">
                      <span>
                        {nama(p.penggunaId)} <span className="text-muted-foreground">({namaPeran.get(p.peranId) ?? p.peranId})</span>
                      </span>
                      <span className="font-medium">{formatRupiah(p.terpakaiRp)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Belum ada pemakaian bulan ini.</p>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Riwayat isi dan pemakaian</h3>
              {data.riwayat.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="riwayat-satker">
                    <thead>
                      <tr className="border-b border-border/70 text-left text-xs text-muted-foreground">
                        <th className="py-1.5 pr-3 font-medium">Waktu</th>
                        <th className="py-1.5 pr-3 font-medium">Jenis</th>
                        <th className="py-1.5 pr-3 font-medium">Siapa</th>
                        <th className="py-1.5 pr-3 text-right font-medium">Jumlah</th>
                        <th className="py-1.5 text-right font-medium">Saldo sesudah</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.riwayat.map((m) => (
                        <tr key={m.id} className="border-b border-border/40">
                          <td className="py-1.5 pr-3 whitespace-nowrap">{waktuIndo(m.waktu)}</td>
                          <td className="py-1.5 pr-3">{LABEL_JENIS[m.jenis] ?? m.jenis}</td>
                          <td className="py-1.5 pr-3">{m.jenis === "potong" ? nama(m.penggunaId) : nama(m.olehId)}</td>
                          <td className={`py-1.5 pr-3 text-right ${m.jumlahRp < 0 ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}`}>{formatRupiah(m.jumlahRp)}</td>
                          <td className="py-1.5 text-right">{formatRupiah(m.saldoSetelah)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Belum ada riwayat.</p>
              )}
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
