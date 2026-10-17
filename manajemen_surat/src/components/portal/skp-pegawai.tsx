"use client";

import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";

import { LembarSkpPegawai } from "@/components/portal/skp-lembar";
import {
  KotakPesan,
  Label,
  Memuat,
  SEBUTAN_ALASAN_HAK,
  namaJabatan,
  useAmbilSkp,
  type BarisPegawaiSkp,
  type JawabanPegawaiSkp,
} from "@/components/portal/skp-umum";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { JABATAN_SKP, LABEL_JABATAN_SKP } from "@/lib/skp-jabatan-tipe";
import { cn } from "@/lib/utils";

/**
 * Daftar pegawai untuk tab Bawahan (atasan langsung) dan Seluruh pegawai
 * (Ketua, Wakil Ketua, Panitera, administrator): memilih seseorang, lalu
 * lembar SKP-nya dibuka di bawah daftar. Hak tiap baris datang dari rute.
 */
export function DaftarPegawaiSkp({
  lingkup,
  kosong,
  dibukaAwal,
}: {
  lingkup: "bawahan" | "semua";
  kosong: string;
  /** Pegawai yang langsung dibuka (mis. dari tab lain). */
  dibukaAwal?: string | null;
}) {
  const [cari, setCari] = useState("");
  const [jabatan, setJabatan] = useState("");
  const [dipilih, setDipilih] = useState<string | null>(dibukaAwal ?? null);
  const [ulang, setUlang] = useState(0);
  const { data, galat, memuat } = useAmbilSkp<JawabanPegawaiSkp>(`/api/skp/pegawai?lingkup=${lingkup}`, lingkup, ulang);

  const tampil = useMemo(() => {
    const kata = cari.trim().toLowerCase();
    return (data?.pegawai ?? []).filter((p) => {
      if (jabatan && p.jabatanUtama !== jabatan) return false;
      if (!kata) return true;
      return p.nama.toLowerCase().includes(kata) || (p.nip ?? "").includes(kata);
    });
  }, [data, cari, jabatan]);

  const terpilih: BarisPegawaiSkp | null = data?.pegawai.find((p) => p.userId === dipilih) ?? null;

  if (memuat && !data) return <Memuat teks="Memuat daftar pegawai…" />;
  if (galat) {
    return (
      <div className="flex flex-col gap-2">
        <KotakPesan jenis="galat">{galat}</KotakPesan>
        <div>
          <Button type="button" size="sm" variant="outline" onClick={() => setUlang((n) => n + 1)}>
            Coba lagi
          </Button>
        </div>
      </div>
    );
  }
  if (!data || data.pegawai.length === 0) {
    return <KotakPesan jenis="info">{kosong}</KotakPesan>;
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-3 py-4">
          <div className="flex flex-wrap items-end gap-3">
            <Label className="min-w-[14rem] flex-1">
              Cari nama atau NIP
              <span className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  value={cari}
                  onChange={(e) => setCari(e.target.value)}
                  aria-label="Cari pegawai"
                  placeholder="Ketik nama atau NIP"
                  className="h-10 pl-9"
                />
              </span>
            </Label>
            {lingkup === "semua" ? (
              <Label>
                Jabatan
                <NativeSelect aria-label="Saring jabatan" value={jabatan} onChange={(e) => setJabatan(e.target.value)} className="h-10 min-w-[13rem]">
                  <option value="">Semua jabatan</option>
                  {JABATAN_SKP.map((j) => (
                    <option key={j} value={j}>
                      {LABEL_JABATAN_SKP[j]}
                    </option>
                  ))}
                </NativeSelect>
              </Label>
            ) : null}
          </div>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" aria-hidden />
            {tampil.length} dari {data.pegawai.length} pegawai
          </p>
          {tampil.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tidak ada pegawai yang cocok dengan pencarian.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-label="Daftar pegawai">
              {tampil.map((p) => (
                <li key={p.userId}>
                  <button
                    type="button"
                    onClick={() => setDipilih(p.userId === dipilih ? null : p.userId)}
                    aria-pressed={p.userId === dipilih}
                    data-pegawai={p.userId}
                    className={cn(
                      "flex h-full w-full flex-col gap-1 rounded-xl border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      p.userId === dipilih
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:border-primary/40 hover:bg-accent/60"
                    )}
                  >
                    <span className="text-sm font-semibold">{p.nama}</span>
                    <span className="text-xs text-muted-foreground">
                      {p.labelJabatanUtama ?? namaJabatan(p.jabatanUtama)}
                      {p.jabatanTambahan.length > 0 ? ` (+ ${p.jabatanTambahan.map((j) => namaJabatan(j)).join(", ")})` : ""}
                    </span>
                    <span className="flex flex-wrap gap-1.5">
                      {p.nip ? <span className="text-xs text-muted-foreground">NIP {p.nip}</span> : null}
                      <Badge variant="muted">{SEBUTAN_ALASAN_HAK[p.alasanHak] ?? "Dapat dilihat"}</Badge>
                    </span>
                    {p.atasanNama ? <span className="text-xs text-muted-foreground">Atasan: {p.atasanNama}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {terpilih ? (
        <section aria-label={`SKP ${terpilih.nama}`} className="flex flex-col gap-3">
          <LembarSkpPegawai key={terpilih.userId} pegawaiUserId={terpilih.userId} jenisTersedia={terpilih.jenisTersedia} />
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">Pilih seorang pegawai untuk membuka SKP-nya.</p>
      )}
    </div>
  );
}
