"use client";

import { useEffect, useState } from "react";
import { Check, CircleAlert, Gift, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ambil, kirimJson } from "@/lib/aleta-ai/klien";
import { formatRupiah, type StatusPromoAi } from "@/lib/aleta-ai/kontrak";

/**
 * Program promosi "Gratis pakai ALETA Ai" - tampilan. Angka dan aturannya dari server
 * (/api/aleta-ai/promo); layar hanya menampilkan. Token warna yang ada (mode gelap ikut).
 */

const KELAS_HIJAU = "border-emerald-300/70 bg-emerald-50 text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200";
const KELAS_KUNING = "border-amber-300/70 bg-amber-50 text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200";

/** Baris sisa jatah, tanpa label teknis. */
export function ringkasJatah(p: StatusPromoAi): string[] {
  const baris: string[] = [];
  if (p.sisaGiliranHariIni !== null) baris.push(`Sisa jatah gratis hari ini: ${p.sisaGiliranHariIni} dari ${p.giliranPerHari} giliran`);
  if (p.sisaRupiah !== null) baris.push(`Sisa nilai gratis: ${formatRupiah(p.sisaRupiah)} dari ${formatRupiah(p.rupiahPeriode)}`);
  if (baris.length === 0) baris.push("Gratis tanpa batas jumlah giliran selama promosi");
  return baris;
}

/** Pita promosi di halaman ALETA Ai (percakapan dan Dompet). `picu` berubah = muat ulang sisa jatah. */
export function PitaPromoAi({ awal, picu = 0 }: { awal?: StatusPromoAi | null; picu?: number }) {
  // Hasil muat ulang sesudah giliran (picu berubah) menimpa nilai awal dari induk.
  const [segar, setSegar] = useState<{ nilai: StatusPromoAi | null } | null>(null);

  useEffect(() => {
    if (!picu) return;
    let batal = false;
    void (async () => {
      const r = await ambil<{ status?: StatusPromoAi }>("/api/aleta-ai/promo");
      if (!batal && r.ok && r.data.status) setSegar({ nilai: r.data.status.tampil ? r.data.status : null });
    })();
    return () => {
      batal = true;
    };
  }, [picu]);

  const status = segar ? segar.nilai : (awal ?? null);
  if (!status?.tampil) return null;
  const hijau = status.berlaku;
  return (
    <div role="status" data-testid="pita-promo-ai" className={`flex flex-wrap items-start gap-x-3 gap-y-1 rounded-xl border px-3 py-2 text-sm ${hijau ? KELAS_HIJAU : KELAS_KUNING}`}>
      <span className="inline-flex items-center gap-1.5 font-semibold">
        <Gift className="size-4 shrink-0" aria-hidden="true" />
        <span className="rounded-md bg-emerald-600 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white dark:bg-emerald-500 dark:text-emerald-950">Gratis</span>
        {status.judul}
      </span>
      <span className="min-w-0 flex-1 basis-60">
        {hijau ? (
          <>
            {ringkasJatah(status).join(". ")}. Berlaku sampai {status.akhirTeks}.
          </>
        ) : (
          <>
            {status.pesan} Promosi berlaku sampai {status.akhirTeks}.
          </>
        )}
      </span>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Lencana "Gratis" di menu portal
// ----------------------------------------------------------------------------

let tembolok: { waktu: number; tampil: boolean } | null = null;
const UMUR_TEMBOLOK_MS = 60_000;

/** Lencana kecil "Gratis" di menu ALETA Ai selama promosi tampil bagi pengguna sasaran. */
export function LencanaGratisAi() {
  const [tampil, setTampil] = useState<boolean>(tembolok?.tampil ?? false);

  useEffect(() => {
    if (tembolok && Date.now() - tembolok.waktu < UMUR_TEMBOLOK_MS) return; // nilai awal state sudah dari tembolok
    let batal = false;
    void (async () => {
      const r = await ambil<{ status?: StatusPromoAi }>("/api/aleta-ai/promo");
      const nilai = Boolean(r.ok && r.data.status?.tampil);
      if (r.ok) tembolok = { waktu: Date.now(), tampil: nilai };
      if (!batal) setTampil(nilai);
    })();
    return () => {
      batal = true;
    };
  }, []);

  if (!tampil) return null;
  return (
    <span
      data-testid="lencana-gratis-ai"
      className="shrink-0 rounded-md bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wide text-white dark:bg-emerald-500 dark:text-emerald-950"
    >
      Gratis
    </span>
  );
}

// ----------------------------------------------------------------------------
// Kartu pengaturan (Super Admin)
// ----------------------------------------------------------------------------

type Konfig = {
  aktif: boolean;
  mulai: string;
  akhir: string;
  judul: string;
  teks: string;
  semuaPeran: boolean;
  peran: string[];
  giliranPerHari: number;
  rupiahPeriode: number;
  batasSatkerRp: number;
};
type DataPromo = { status: StatusPromoAi; konfig?: Konfig; terpakaiApiRp?: number };

const angka = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
};

function Medan({ label, hint, children, htmlFor }: { label: string; hint?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function KartuPromoAi({ peranTersedia }: { peranTersedia: Array<{ id: string; name: string }> }) {
  const [data, setData] = useState<DataPromo | null>(null);
  const [form, setForm] = useState<Konfig | null>(null);
  const [pesan, setPesan] = useState<{ teks: string; baik: boolean }>({ teks: "", baik: false });
  const [menyimpan, setMenyimpan] = useState(false);

  useEffect(() => {
    let batal = false;
    void (async () => {
      const r = await ambil<DataPromo>("/api/aleta-ai/promo");
      if (batal) return;
      if (!r.ok) {
        setPesan({ teks: r.galat, baik: false });
        return;
      }
      setData(r.data);
      if (r.data.konfig) setForm(r.data.konfig);
    })();
    return () => {
      batal = true;
    };
  }, []);

  async function simpan() {
    if (!form) return;
    setMenyimpan(true);
    const r = await kirimJson<DataPromo>("/api/aleta-ai/promo", "PUT", form);
    setMenyimpan(false);
    if (r.ok) {
      setData(r.data);
      if (r.data.konfig) setForm(r.data.konfig);
      setPesan({ teks: form.aktif ? "Program promosi disimpan dan menyala." : "Pengaturan promosi disimpan (promosi mati).", baik: true });
    } else {
      setPesan({ teks: r.galat, baik: false });
    }
  }

  const ubah = <K extends keyof Konfig>(k: K, v: Konfig[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const adaPeran = (id: string) => Boolean(form?.peran.includes(id));
  const gantiPeran = (id: string) => form && ubah("peran", adaPeran(id) ? form.peran.filter((p) => p !== id) : [...form.peran, id]);

  return (
    <Card className="border-border/80" id="promo">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Gift className="size-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" /> Gratis pakai ALETA Ai (promosi)
          {form?.aktif ? <Badge variant="default">Menyala</Badge> : <Badge variant="muted">Mati</Badge>}
        </CardTitle>
        <CardDescription>
          Selama promosi, pengguna sasaran memakai ALETA Ai tanpa memotong saldo atau kuota, sampai jatahnya habis; sesudah itu kembali ke kuota dan saldo. Batas harian, batas satker bulanan, dan batas laju tetap berlaku.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4" data-testid="kartu-promo">
        {!form ? (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Memuat pengaturan promosi...
          </p>
        ) : (
          <>
            <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/30 px-4 py-3">
              <Switch checked={form.aktif} onCheckedChange={(v) => ubah("aktif", v)} aria-labelledby="label-promo-aktif" />
              <p className="text-sm font-medium" id="label-promo-aktif">
                Promosi {form.aktif ? "menyala" : "mati"}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Medan label="Mulai (WITA)" htmlFor="promo-mulai">
                <Input id="promo-mulai" type="date" value={form.mulai} onChange={(e) => ubah("mulai", e.target.value)} className="w-48" />
              </Medan>
              <Medan label="Berakhir (WITA, termasuk hari itu)" htmlFor="promo-akhir">
                <Input id="promo-akhir" type="date" value={form.akhir} onChange={(e) => ubah("akhir", e.target.value)} className="w-48" />
              </Medan>
              <Medan label="Judul promosi" htmlFor="promo-judul">
                <Input id="promo-judul" value={form.judul} maxLength={80} onChange={(e) => ubah("judul", e.target.value)} />
              </Medan>
              <Medan label="Teks singkat" htmlFor="promo-teks">
                <Input id="promo-teks" value={form.teks} maxLength={240} onChange={(e) => ubah("teks", e.target.value)} />
              </Medan>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Sasaran</legend>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="promo-sasaran" checked={form.semuaPeran} onChange={() => ubah("semuaPeran", true)} /> Semua pengguna
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="promo-sasaran" checked={!form.semuaPeran} onChange={() => ubah("semuaPeran", false)} /> Peran tertentu
                </label>
              </div>
              {!form.semuaPeran ? (
                <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-xl border border-border/70 bg-card px-3 py-2" data-testid="promo-peran">
                  {peranTersedia
                    .filter((p) => p.id !== "super-admin")
                    .map((p) => (
                      <label key={p.id} className="inline-flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={adaPeran(p.id)} onChange={() => gantiPeran(p.id)} /> {p.name}
                      </label>
                    ))}
                </div>
              ) : null}
            </fieldset>

            <div className="grid gap-4 md:grid-cols-3">
              <Medan label="Giliran gratis per hari" htmlFor="promo-giliran" hint="Per pengguna. 0 = tanpa batas jumlah giliran.">
                <Input id="promo-giliran" type="number" inputMode="numeric" min={0} value={form.giliranPerHari} onChange={(e) => ubah("giliranPerHari", angka(e.target.value))} />
              </Medan>
              <Medan label="Nilai gratis per pengguna (Rp)" htmlFor="promo-rupiah" hint="Selama periode, setara harga normal. 0 = tanpa batas rupiah.">
                <Input id="promo-rupiah" type="number" inputMode="numeric" min={0} step="1000" value={form.rupiahPeriode} onChange={(e) => ubah("rupiahPeriode", angka(e.target.value))} />
              </Medan>
              <Medan
                label="Batas biaya API promosi satker (Rp)"
                htmlFor="promo-satker"
                hint={`Pengaman tagihan: bila tercapai, promosi berhenti untuk semua. Terpakai sejauh ini ${formatRupiah(Math.round(data?.terpakaiApiRp ?? 0))}.`}
              >
                <Input id="promo-satker" type="number" inputMode="numeric" min={0} step="10000" value={form.batasSatkerRp} onChange={(e) => ubah("batasSatkerRp", angka(e.target.value))} />
              </Medan>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => void simpan()} disabled={menyimpan}>
                {menyimpan ? "Menyimpan..." : "Simpan promosi"}
              </Button>
              {pesan.teks ? (
                <p role="status" className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${pesan.baik ? KELAS_HIJAU : KELAS_KUNING}`}>
                  {pesan.baik ? <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
                  <span className="min-w-0">{pesan.teks}</span>
                </p>
              ) : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
