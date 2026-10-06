"use client";

/**
 * ============================================================================
 * PETA PENETAPAN - INTEGRASI E-COURT (perbaikan 6 Okt 2026, butir 19-20)
 * ============================================================================
 *
 * Satu kartu per jenis penetapan (PMH, PHS, PPP, PJS):
 *
 *   - blangko ABT yang dicetak (nama berkas + kelompok ABT yang didahulukan),
 *   - tempat unggah di SIPP (tetap: e-Doc tab Penetapan),
 *   - unggah otomatis sesudah penetapan tertulis lewat panel SIPP,
 *   - tanda tangan (ya/tidak, siapa penanda tangannya, tahan bila tidak ada),
 *   - cap kantor (ya/tidak, cap yang dipakai, ukuran & letak terhadap ttd),
 *   - ganti gambar bawaan blangko di blok tanda tangan.
 *
 * Bawaan: PMH -> "@ 1 - PMH", PHS -> "@ 2 - PHS"; PPP/PJS dimatikan sampai
 * blangkonya ada - menambahkannya cukup dari layar ini, tanpa kode.
 *
 * Hanya Super Admin / Admin yang dapat MENGUBAH (rute menolak yang lain);
 * pegawai lain melihatnya terkunci. Gambar cap dan tanda tangan diunggah di
 * ALETA e-Court > Berkas tanda tangan.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { RefreshCw, RotateCcw, Save, Stamp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiPath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
import {
  BATAS_UKURAN_MM,
  PENANDATANGAN_PENETAPAN,
  type AturPenetapan,
  type JenisPetaPenetapan,
  type KunciUkuran,
} from "@/lib/peta-penetapan";

type Butir = AturPenetapan & {
  jenis: JenisPetaPenetapan;
  sebutan: string;
  sumber: "admin" | "bawaan";
  diubahPada: string | null;
  tempatUnggah: { tabel: string; jenisDokumenId: number; rujukan: string; berkas: string };
};

type Cap = { id: string; nama: string; peruntukan: string; aktif: boolean };

const RUTE = "/api/aleta-ecourt/penetapan-edoc/peta-penetapan";

type HasilBaca = { ok: true; butir: Butir[]; boleh: boolean } | { ok: false; pesan: string };

async function bacaPeta(): Promise<HasilBaca> {
  try {
    const r = await fetch(apiPath(RUTE), { credentials: "include", cache: "no-store" });
    const isi = (await r.json().catch(() => ({}))) as { data?: { butir?: Butir[]; bolehMengubah?: boolean } };
    if (r.status === 404) return { ok: false, pesan: "Peta penetapan belum tersedia di server." };
    if (!r.ok) return { ok: false, pesan: pesanGalatPortal(isi, `ALETA menjawab ${r.status}.`) };
    return { ok: true, butir: Array.isArray(isi.data?.butir) ? isi.data.butir : [], boleh: Boolean(isi.data?.bolehMengubah) };
  } catch {
    return { ok: false, pesan: "Peta penetapan tidak dapat dibaca." };
  }
}

async function bacaCap(): Promise<Cap[]> {
  try {
    const r = await fetch(apiPath("/api/aleta-ecourt/penetapan-edoc/cap"), { credentials: "include", cache: "no-store" });
    if (!r.ok) return [];
    const isi = (await r.json()) as { data?: { baris?: Cap[] } };
    return Array.isArray(isi.data?.baris) ? isi.data.baris.filter((c) => c.aktif) : [];
  } catch {
    return [];
  }
}

/** Gambar kecil letak tanda tangan dan cap terhadap nama - skala 2 px/mm. */
function PratinjauLetak({ a }: { a: AturPenetapan }) {
  const s = 2;
  const ttdL = a.lebarTtdMm * s;
  const ttdT = Math.min(a.lebarTtdMm / 2, a.tinggiTtdMaksMm) * s;
  const capL = a.lebarCapMm * s;
  const capT = capL * 1.2;
  const ox = 70;
  const namaY = 110;
  const ttdX = ox + a.ttdGeserKananMm * s;
  const ttdY = namaY - ttdT + a.ttdTurunMm * s;
  const capCx = ttdX + ttdL / 2 - a.capGeserKiriMm * s;
  const capCy = ttdY + ttdT / 2 - a.capGeserAtasMm * s;
  return (
    <svg viewBox="0 0 260 130" className="h-28 w-full max-w-[18rem] rounded border border-border bg-white" role="img" aria-label="Pratinjau letak tanda tangan dan cap">
      <text x={ox} y={namaY - ttdT - 14} fontSize="9" fill="#555">
        {a.labelPenandatangan || "Ketua,"}
      </text>
      {a.pakaiTtd ? (
        <g>
          <rect x={ttdX} y={ttdY} width={ttdL} height={ttdT} fill="#dbeafe" stroke="#1d4ed8" strokeDasharray="3 2" />
          <text x={ttdX + 3} y={ttdY + 11} fontSize="8" fill="#1d4ed8">
            tanda tangan
          </text>
        </g>
      ) : null}
      {a.pakaiCap ? (
        <ellipse cx={capCx} cy={capCy} rx={capL / 2} ry={capT / 2} fill="rgba(124,58,237,0.18)" stroke="#7c3aed" />
      ) : null}
      <text x={ox} y={namaY + 12} fontSize="9" fontWeight="bold" fill="#111">
        Nama Penanda Tangan, S.H.
      </text>
    </svg>
  );
}

function KartuJenis({
  awal,
  boleh,
  cap,
  onSimpan,
  sibuk,
}: {
  awal: Butir;
  boleh: boolean;
  cap: Cap[];
  onSimpan: (butir: Record<string, unknown>) => Promise<void>;
  sibuk: boolean;
}) {
  const [a, setA] = useState<AturPenetapan>(awal);
  const ubah = <K extends keyof AturPenetapan>(k: K, v: AturPenetapan[K]) => setA((x) => ({ ...x, [k]: v }));
  const berubah = useMemo(() => JSON.stringify(pilihAtur(a)) !== JSON.stringify(pilihAtur(awal)), [a, awal]);
  const kunci = !boleh || sibuk;
  const kotak = (k: "aktif" | "otomatisUnggah" | "pakaiTtd" | "pakaiCap" | "gantiGambarBawaan" | "tahanBilaTanpaTtd", teks: string, tidakAktif = false) => (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" className="mt-1" checked={Boolean(a[k])} disabled={kunci || tidakAktif} onChange={(e) => ubah(k, e.target.checked)} />
      <span>{teks}</span>
    </label>
  );
  const angka = (k: KunciUkuran) => (
    <label key={k} className="flex flex-col gap-1 text-xs text-muted-foreground">
      {BATAS_UKURAN_MM[k].sebutan}
      <Input
        type="number"
        step="0.5"
        min={BATAS_UKURAN_MM[k].min}
        max={BATAS_UKURAN_MM[k].max}
        value={String(a[k])}
        disabled={kunci}
        onChange={(e) => ubah(k, Number(e.target.value))}
      />
    </label>
  );
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4" data-peta-penetapan={awal.jenis}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium text-foreground">{awal.sebutan}</p>
        <Badge variant={a.aktif ? "default" : "muted"}>{a.aktif ? "Aktif" : "Mati"}</Badge>
        {a.aktif && a.otomatisUnggah ? <Badge variant="outline">Unggah otomatis</Badge> : null}
        <Badge variant="outline">{awal.sumber === "admin" ? "Diatur admin" : "Bawaan"}</Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          {kotak("aktif", "Aktif - jenis ini disusun dari blangko ABT")}
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Nama blangko ABT (persis seperti di ABT)
            <Input value={a.namaBerkas} disabled={kunci} placeholder="@ 1 - PMH.rtf" onChange={(e) => ubah("namaBerkas", e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Kelompok blangko ABT yang didahulukan
            <Input value={a.kelompok} disabled={kunci} placeholder="Form Bantu PTSP" onChange={(e) => ubah("kelompok", e.target.value)} />
          </label>
          <p className="text-xs text-muted-foreground">
            Tempat unggah SIPP: e-Doc tab Penetapan ({awal.tempatUnggah.tabel}, jenis_dokumen_id {awal.tempatUnggah.jenisDokumenId}, merujuk{" "}
            {awal.tempatUnggah.rujukan}) - sama dengan unggahan manual petugas.
          </p>
          {kotak("otomatisUnggah", "Unggah otomatis ke SIPP sesudah penetapan ini tertulis lewat panel SIPP", !a.aktif)}
        </div>

        <div className="space-y-2">
          {kotak("pakaiTtd", "Bubuhkan tanda tangan sesuai nama penanda tangan")}
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Penanda tangan
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              value={a.penandatangan}
              disabled={kunci}
              onChange={(e) => ubah("penandatangan", e.target.value as AturPenetapan["penandatangan"])}
            >
              {PENANDATANGAN_PENETAPAN.map((p) => (
                <option key={p.kode} value={p.kode}>
                  {p.sebutan}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Label jabatan tegas (opsional, mis. &quot;Ketua,&quot;) - kosong = menurut penanda tangan
            <Input value={a.labelPenandatangan} disabled={kunci} onChange={(e) => ubah("labelPenandatangan", e.target.value)} />
          </label>
          {kotak("tahanBilaTanpaTtd", "Tahan (jangan unggah) bila tanda tangan untuk nama itu belum ada")}
          {kotak("pakaiCap", "Bubuhkan cap kantor DI ATAS tanda tangan")}
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Cap yang dipakai
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              value={a.capId}
              disabled={kunci || !a.pakaiCap}
              onChange={(e) => ubah("capId", e.target.value)}
            >
              <option value="">Cap aktif terbaru sesuai peruntukan</option>
              {cap.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nama} ({c.peruntukan})
                </option>
              ))}
            </select>
          </label>
          {kotak("gantiGambarBawaan", "Ganti gambar tanda tangan/cap bawaan blangko di blok tanda tangan")}
        </div>
      </div>

      <details className="rounded-md border border-border p-3">
        <summary className="cursor-pointer text-sm font-medium">Ukuran & letak tanda tangan dan cap</summary>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="grid gap-2 sm:grid-cols-2">{(Object.keys(BATAS_UKURAN_MM) as KunciUkuran[]).map(angka)}</div>
          <PratinjauLetak a={a} />
        </div>
      </details>

      {boleh ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={sibuk || !berubah} onClick={() => void onSimpan({ jenis: awal.jenis, ...pilihAtur(a) })}>
            <Save className="mr-1.5 h-3.5 w-3.5" />
            Simpan {awal.jenis.toUpperCase()}
          </Button>
          {awal.sumber === "admin" ? (
            <Button type="button" size="sm" variant="outline" disabled={sibuk} onClick={() => void onSimpan({ jenis: awal.jenis, kembalikanBawaan: true })}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Kembalikan bawaan
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function pilihAtur(a: AturPenetapan): AturPenetapan {
  return {
    aktif: a.aktif,
    namaBerkas: a.namaBerkas,
    kelompok: a.kelompok,
    otomatisUnggah: a.otomatisUnggah,
    pakaiTtd: a.pakaiTtd,
    pakaiCap: a.pakaiCap,
    penandatangan: a.penandatangan,
    labelPenandatangan: a.labelPenandatangan,
    gantiGambarBawaan: a.gantiGambarBawaan,
    tahanBilaTanpaTtd: a.tahanBilaTanpaTtd,
    capId: a.capId,
    lebarTtdMm: a.lebarTtdMm,
    tinggiTtdMaksMm: a.tinggiTtdMaksMm,
    ttdGeserKananMm: a.ttdGeserKananMm,
    ttdTurunMm: a.ttdTurunMm,
    lebarCapMm: a.lebarCapMm,
    capGeserKiriMm: a.capGeserKiriMm,
    capGeserAtasMm: a.capGeserAtasMm,
  };
}

export function AletaEcourtPetaPenetapan() {
  const [butir, setButir] = useState<Butir[]>([]);
  const [boleh, setBoleh] = useState(false);
  const [cap, setCap] = useState<Cap[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState("");
  const [versi, setVersi] = useState(0);

  const terapkan = useCallback((h: HasilBaca, c: Cap[]) => {
    if (h.ok) {
      setButir(h.butir);
      setBoleh(h.boleh);
    } else setPesan(h.pesan);
    setCap(c);
    setMemuat(false);
    setVersi((v) => v + 1);
  }, []);

  useEffect(() => {
    let batal = false;
    void Promise.all([bacaPeta(), bacaCap()]).then(([h, c]) => {
      if (!batal) terapkan(h, c);
    });
    return () => {
      batal = true;
    };
  }, [terapkan]);

  const muat = useCallback(async () => {
    setMemuat(true);
    setPesan("");
    const [h, c] = await Promise.all([bacaPeta(), bacaCap()]);
    terapkan(h, c);
  }, [terapkan]);

  const simpan = useCallback(
    async (satu: Record<string, unknown>) => {
      setSibuk(true);
      setPesan("");
      try {
        const r = await fetch(apiPath(RUTE), {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ butir: [satu] }),
        });
        const isi = (await r.json().catch(() => ({}))) as { data?: { butir?: Butir[]; bolehMengubah?: boolean } };
        if (!r.ok) {
          setPesan(pesanGalatPortal(isi, `ALETA menjawab ${r.status}.`));
          return;
        }
        terapkan({ ok: true, butir: isi.data?.butir ?? [], boleh: Boolean(isi.data?.bolehMengubah) }, cap);
        setPesan(`${String(satu.jenis).toUpperCase()} tersimpan.`);
      } catch {
        setPesan("Permintaan tidak terkirim.");
      } finally {
        setSibuk(false);
      }
    },
    [cap, terapkan]
  );

  return (
    <Card id="peta-penetapan" className="scroll-mt-24">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Stamp className="h-4 w-4" aria-hidden />
          Peta penetapan
          <Badge variant="outline">{butir.filter((b) => b.aktif).length} aktif</Badge>
        </CardTitle>
        <CardDescription>
          Jenis penetapan &rarr; blangko ABT &rarr; e-Doc penetapan SIPP, beserta tanda tangan dan cap kantor. Sesudah penetapan tertulis lewat
          panel SIPP, ekstensi mencetak blangkonya dari ABT dengan sesi ABT petugas, ALETA membubuhkan tanda tangan sesuai nama penanda
          tangan (dan cap di atasnya), lalu mengunggahnya ke SIPP atas akun petugas yang sedang masuk. Gambar cap dan tanda tangan diunggah di{" "}
          <Link className="underline" href="/aleta-ecourt#ttd">
            ALETA e-Court &rsaquo; Berkas tanda tangan
          </Link>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => void muat()} disabled={memuat || sibuk}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Muat ulang
          </Button>
          {!boleh && !memuat ? <p className="text-xs text-muted-foreground">Hanya Super Admin dan Admin yang dapat mengubah peta penetapan.</p> : null}
        </div>
        {pesan ? <p className="text-sm text-muted-foreground">{pesan}</p> : null}
        {memuat ? (
          <div className="min-h-[8rem] animate-pulse rounded-lg border border-border bg-muted/30" />
        ) : (
          <div className="space-y-4">
            {butir.map((b) => (
              <KartuJenis key={`${b.jenis}-${versi}`} awal={b} boleh={boleh} cap={cap} onSimpan={simpan} sibuk={sibuk} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
