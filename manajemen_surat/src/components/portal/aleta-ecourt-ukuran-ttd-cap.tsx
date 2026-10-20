"use client";

/**
 * ============================================================================
 * UKURAN TANDA TANGAN DAN CAP (20 Okt 2026)
 * ============================================================================
 *
 * Satu set ukuran untuk SEMUA dokumen yang dibubuhi tanda tangan: e-Doc
 * penetapan, "Tambah tanda tangan ke PDF" di ekstensi, dan PDF salinan putusan.
 * Tanda tangan menimpa +-1/3 atas nama penanda tangan; cap berdiameter tetap
 * menindih sisi kiri tanda tangan, hanya bila penanda tangan/dokumennya
 * berhak cap (aturan yang sudah ada - kartu ini tidak menambah hak).
 *
 * Tampil hanya untuk Super Admin dan Admin. Pratinjau di sini digambar dari
 * rumus yang sama dengan bot (geometriPratinjau) - bukan tangkapan layar PDF.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { RefreshCw, RotateCcw, Save } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiPath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
import {
  BATAS_UKURAN_TTD_CAP,
  KUNCI_UKURAN_TTD_CAP,
  UKURAN_TTD_CAP_BAWAAN,
  geometriPratinjau,
  type KunciUkuranTtdCap,
  type UkuranTtdCap,
} from "@/lib/ukuran-ttd-cap";

type Jawaban = {
  ukuran: UkuranTtdCap;
  bawaan: UkuranTtdCap;
  tersimpan: boolean;
  diubahPada: string | null;
  pemberitahuanLama: string;
  bolehMengubah: boolean;
};

const KOLOM: Array<{ kunci: KunciUkuranTtdCap; label: string; ket: string; langkah: string }> = [
  { kunci: "lebarTtdMm", label: "Lebar tanda tangan (mm)", ket: "Tingginya mengikuti perbandingan gambar.", langkah: "1" },
  { kunci: "ttdTurunMm", label: "Geser turun terhadap nama (mm)", ket: "Makin besar, makin menimpa baris nama.", langkah: "0.5" },
  { kunci: "diameterCapMm", label: "Diameter cap (mm)", ket: "Tetap, tidak mengikuti ukuran gambar cap.", langkah: "1" },
  { kunci: "capGeserKiriMm", label: "Posisi cap: ke kiri dari pusat tanda tangan (mm)", ket: "Nilai negatif = ke kanan.", langkah: "0.5" },
  { kunci: "capGeserAtasMm", label: "Posisi cap: ke atas dari pusat tanda tangan (mm)", ket: "Nilai negatif = ke bawah.", langkah: "0.5" },
  { kunci: "opasitasCap", label: "Keburaman cap (0,3 - 1)", ket: "1 = pekat; makin kecil makin tembus pandang.", langkah: "0.01" },
];

/** Pratinjau kecil: baris nama, kotak tanda tangan (corat-coret contoh), dan lingkaran cap. */
export function PratinjauUkuranTtdCap({ ukuran }: { ukuran: UkuranTtdCap }) {
  const g = geometriPratinjau(ukuran);
  const capKiri = g.cap.pusatX - g.cap.diameter / 2;
  const minX = Math.min(0, capKiri) - 4;
  const maxX = Math.max(g.ttd.lebar, g.cap.pusatX + g.cap.diameter / 2, 70) + 4;
  const minY = Math.min(g.ttd.atas, g.cap.pusatY - g.cap.diameter / 2) - 4;
  const maxY = 9;
  const skala = 3; // px per mm
  return (
    <svg
      role="img"
      aria-label="Pratinjau ukuran tanda tangan dan cap terhadap baris nama"
      data-pratinjau-ukuran-ttd-cap="1"
      viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
      width={(maxX - minX) * skala}
      height={(maxY - minY) * skala}
      className="max-w-full rounded-md border border-border bg-card text-foreground"
    >
      {/* baris nama (tinggi +-5 mm) */}
      <rect x={0} y={0} width={64} height={5} rx={0.6} fill="currentColor" opacity={0.1} />
      <text x={1} y={3.8} fontSize={3.4} fill="currentColor">
        Nama Penanda Tangan, S.H.
      </text>
      {/* tanda tangan contoh */}
      <rect x={g.ttd.kiri} y={g.ttd.atas} width={g.ttd.lebar} height={g.ttd.tinggi} fill="none" stroke="currentColor" strokeDasharray="1.2 1" strokeWidth={0.3} opacity={0.5} />
      <path
        d={`M ${g.ttd.lebar * 0.08} ${g.ttd.atas + g.ttd.tinggi * 0.7} C ${g.ttd.lebar * 0.2} ${g.ttd.atas + g.ttd.tinggi * 0.1}, ${g.ttd.lebar * 0.3} ${g.ttd.atas + g.ttd.tinggi * 0.9}, ${g.ttd.lebar * 0.45} ${g.ttd.atas + g.ttd.tinggi * 0.4} S ${g.ttd.lebar * 0.7} ${g.ttd.atas + g.ttd.tinggi * 0.8}, ${g.ttd.lebar * 0.92} ${g.ttd.atas + g.ttd.tinggi * 0.25}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={0.7}
        strokeLinecap="round"
        opacity={0.85}
      />
      {/* cap */}
      <circle cx={g.cap.pusatX} cy={g.cap.pusatY} r={g.cap.diameter / 2} fill="currentColor" fillOpacity={0.06} stroke="currentColor" strokeWidth={0.5} opacity={Math.max(0.3, ukuran.opasitasCap)} />
      <circle cx={g.cap.pusatX} cy={g.cap.pusatY} r={g.cap.diameter / 2 - 2} fill="none" stroke="currentColor" strokeWidth={0.25} opacity={Math.max(0.3, ukuran.opasitasCap)} />
    </svg>
  );
}

export function AletaEcourtUkuranTtdCap() {
  const [data, setData] = useState<Jawaban | null>(null);
  const [isi, setIsi] = useState<Record<KunciUkuranTtdCap, string>>(() => aSemuaTeks(UKURAN_TTD_CAP_BAWAAN));
  const [galat, setGalat] = useState("");
  const [info, setInfo] = useState("");
  const [sibuk, setSibuk] = useState(false);

  const terapkan = useCallback((j: Jawaban) => {
    setData(j);
    setIsi(aSemuaTeks(j.ukuran));
  }, []);

  /** Membaca ukuran - TANPA menyentuh state komponen (lihat aleta-ecourt-cap). */
  const baca = useCallback(async (): Promise<{ ok: true; j: Jawaban } | { ok: false; pesan: string }> => {
    try {
      const r = await fetch(apiPath("/api/aleta-ecourt/ukuran-ttd-cap"), { credentials: "include", cache: "no-store" });
      const j = (await r.json().catch(() => ({}))) as { data?: Jawaban };
      if (!r.ok || !j.data) return { ok: false, pesan: pesanGalatPortal(j, `Server menjawab ${r.status}`) };
      return { ok: true, j: j.data };
    } catch (e) {
      return { ok: false, pesan: e instanceof Error ? e.message : "Gagal membaca ukuran." };
    }
  }, []);

  const muat = useCallback(async () => {
    setGalat("");
    const h = await baca();
    if (h.ok) terapkan(h.j);
    else setGalat(h.pesan);
  }, [baca, terapkan]);

  useEffect(() => {
    let batal = false;
    void baca().then((h) => {
      if (batal) return;
      if (h.ok) terapkan(h.j);
      else setGalat(h.pesan);
    });
    return () => {
      batal = true;
    };
  }, [baca, terapkan]);

  const pratinjau = useMemo<UkuranTtdCap>(() => {
    const u = { ...(data?.ukuran ?? UKURAN_TTD_CAP_BAWAAN) };
    for (const k of KUNCI_UKURAN_TTD_CAP) {
      const n = Number(String(isi[k]).replace(",", "."));
      const b = BATAS_UKURAN_TTD_CAP[k];
      if (isi[k] !== "" && Number.isFinite(n)) u[k] = Math.min(b.max, Math.max(b.min, n));
    }
    return u;
  }, [isi, data]);

  async function kirim(badan: Record<string, unknown>, pesan: string) {
    setSibuk(true);
    setGalat("");
    setInfo("");
    try {
      const r = await fetch(apiPath("/api/aleta-ecourt/ukuran-ttd-cap"), {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(badan),
      });
      const j = (await r.json().catch(() => ({}))) as { data?: Jawaban };
      if (!r.ok || !j.data) throw new Error(pesanGalatPortal(j, `Server menjawab ${r.status}`));
      terapkan(j.data);
      setInfo(pesan);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setSibuk(false);
    }
  }

  // Hanya Super Admin dan Admin; pegawai lain tidak melihat kartu ini.
  if (data && !data.bolehMengubah) return null;
  if (!data && !galat) return null;

  return (
    <Card data-ukuran-ttd-cap="1">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Ukuran tanda tangan &amp; cap
          {data?.tersimpan ? <Badge variant="warning">diubah dari bawaan</Badge> : <Badge variant="muted">bawaan</Badge>}
        </CardTitle>
        <CardDescription>
          Berlaku sama untuk e-Doc penetapan, tombol Tambah tanda tangan di ekstensi, dan PDF salinan putusan. Tanda tangan
          menimpa sekitar sepertiga atas nama; cap menindih sisi kiri tanda tangan dan hanya dibubuhkan pada penanda tangan
          yang berhak cap (Ketua pada penetapan Ketua, Panitera pada salinan).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {data?.pemberitahuanLama ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs" data-ukuran-lama="1">
            <span className="min-w-0 flex-1">{data.pemberitahuanLama}</span>
            <Button type="button" size="sm" variant="outline" disabled={sibuk} onClick={() => void kirim({ kembalikanBawaan: true }, "Ukuran lama dibuang; bawaan baru berlaku.")}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Kembalikan bawaan
            </Button>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="grid gap-3 sm:grid-cols-2">
            {KOLOM.map((k) => (
              <label key={k.kunci} className="space-y-1 text-xs">
                <span className="font-medium">{k.label}</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  step={k.langkah}
                  min={BATAS_UKURAN_TTD_CAP[k.kunci].min}
                  max={BATAS_UKURAN_TTD_CAP[k.kunci].max}
                  value={isi[k.kunci]}
                  disabled={sibuk}
                  data-ukuran-kolom={k.kunci}
                  onChange={(e) => setIsi((s) => ({ ...s, [k.kunci]: e.target.value }))}
                />
                <span className="block text-muted-foreground">
                  {k.ket} Bawaan {String(UKURAN_TTD_CAP_BAWAAN[k.kunci]).replace(".", ",")}.
                </span>
              </label>
            ))}
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium">Pratinjau (gambar contoh)</p>
            <PratinjauUkuranTtdCap ukuran={pratinjau} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" disabled={sibuk || !data} onClick={() => void kirim(salinNilai(isi), "Ukuran disimpan; berlaku untuk dokumen berikutnya.")}>
            <Save className="mr-1.5 h-3.5 w-3.5" />
            Simpan ukuran
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={sibuk || !data} onClick={() => void kirim({ kembalikanBawaan: true }, "Dikembalikan ke bawaan.")}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Kembalikan bawaan
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={sibuk} onClick={() => void muat()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Muat ulang
          </Button>
          {info ? <span className="text-xs text-emerald-700">{info}</span> : null}
          {galat ? <span className="text-xs text-destructive">{galat}</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function aSemuaTeks(u: UkuranTtdCap): Record<KunciUkuranTtdCap, string> {
  const hasil = {} as Record<KunciUkuranTtdCap, string>;
  for (const k of KUNCI_UKURAN_TTD_CAP) hasil[k] = String(u[k]);
  return hasil;
}

function salinNilai(isi: Record<KunciUkuranTtdCap, string>): Record<string, number | string> {
  const hasil: Record<string, number | string> = {};
  for (const k of KUNCI_UKURAN_TTD_CAP) hasil[k] = String(isi[k]).replace(",", ".");
  return hasil;
}
