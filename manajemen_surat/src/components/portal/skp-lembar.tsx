"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Plus, RotateCcw, Trash2 } from "lucide-react";

import {
  BarisUnduhSkp,
  KotakPesan,
  Label,
  Memuat,
  TandaSumber,
  alamatUnduhLembarSkp,
  ambilSkp,
  hariIniWita,
  bulanSelesaiTerakhir,
  kunciBulan,
  labelPeriode,
  modeDariKunci,
  namaJabatan,
  namaJenisSkp,
  pesanGalat,
  periodeSahUntukTahun,
  useAmbilSkp,
  useUnduhSkp,
  NAMA_BULAN,
  PILIHAN_TRIWULAN,
  type JawabanLembarSkp,
  type ModePeriodeSkp,
} from "@/components/portal/skp-umum";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { mulaiPeriodeSkpJabatan } from "@/lib/eviden-skp-unduh";
import type {
  BuktiIsianSkp,
  IndikatorSkp,
  IsianManualSkp,
  JenisSkp,
  KunciPeriodeSkpJabatan,
  RhkSkp,
} from "@/lib/skp-jabatan-tipe";
import { tanggalPanjang } from "@/lib/tanggal-indonesia";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * LEMBAR SKP SATU PEGAWAI (layar /skp)
 * ============================================================================
 *
 * Satu komponen untuk "SKP Saya", Bawahan, dan Seluruh pegawai: yang berbeda
 * hanya pegawai yang dibuka. Hak (mengisi, meninjau) selalu mengikuti jawaban
 * rute `hak`, bukan tebakan layar. Angka dari SIPP bertanda "dari SIPP", angka
 * yang diisi sendiri bertanda "isian"; angka yang tidak terbaca tampil "—"
 * dan tidak pernah menjadi nol.
 */

const STATUS_ISIAN: Record<IsianManualSkp["status"], { teks: string; variant: "muted" | "warning" | "success"; arti: string }> = {
  draf: { teks: "Draf", variant: "muted", arti: "belum dihitung - ajukan agar dihitung" },
  diajukan: { teks: "Diajukan", variant: "warning", arti: "sudah dihitung, menunggu persetujuan atasan" },
  disetujui: { teks: "Disetujui", variant: "success", arti: "sudah disetujui atasan" },
};

type MasukanBukti = { judul: string; rujukan: string; tanggal: string };

function bukti2masukan(b: BuktiIsianSkp[]): MasukanBukti[] {
  return b.map((x) => ({ judul: x.judul, rujukan: x.rujukan ?? "", tanggal: x.tanggal ?? "" }));
}

// ─── Isian manual satu indikator ─────────────────────────────────────────────

function EditorIsian({
  indikator,
  rhk,
  isian,
  pegawaiUserId,
  tahun,
  periode,
  onSelesai,
  onTutup,
}: {
  indikator: IndikatorSkp;
  rhk: RhkSkp;
  isian: IsianManualSkp | null;
  pegawaiUserId: string;
  tahun: number;
  periode: KunciPeriodeSkpJabatan;
  onSelesai: (pesan: string) => void;
  onTutup: () => void;
}) {
  const terkunci = isian !== null && isian.status !== "draf";
  const [nilai, setNilai] = useState(isian && isian.nilai !== null ? String(isian.nilai) : "");
  const [nilaiTeks, setNilaiTeks] = useState(isian?.nilaiTeks ?? "");
  const [catatan, setCatatan] = useState(isian?.catatan ?? "");
  const [bukti, setBukti] = useState<MasukanBukti[]>(bukti2masukan(isian?.bukti ?? []));
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");

  const ubahBukti = (i: number, bagian: Partial<MasukanBukti>) =>
    setBukti((b) => b.map((x, j) => (j === i ? { ...x, ...bagian } : x)));

  const simpan = async (): Promise<IsianManualSkp> => {
    const hasil = await ambilSkp<{ isian: IsianManualSkp }>("/api/skp/isian", {
      metode: "PUT",
      badan: {
        pegawai: pegawaiUserId,
        periode,
        tahun,
        kunciRhk: rhk.kunci,
        kunciIndikator: indikator.kunci,
        nilai: nilai.trim() === "" ? null : Number(nilai),
        nilaiTeks: nilaiTeks.trim(),
        catatan: catatan.trim(),
        bukti: bukti
          .filter((b) => b.judul.trim() !== "")
          .map((b) => ({ judul: b.judul.trim(), rujukan: b.rujukan.trim() || null, tanggal: b.tanggal.trim() || null })),
      },
    });
    return hasil.isian;
  };

  const jalankan = async (ajukan: boolean) => {
    setSibuk(true);
    setGalat("");
    try {
      if (nilai.trim() !== "" && !Number.isFinite(Number(nilai))) throw new Error("Nilai harus berupa angka.");
      const tersimpan = await simpan();
      if (ajukan) await ambilSkp("/api/skp/isian", { metode: "POST", badan: { aksi: "ajukan", id: tersimpan.id } });
      onSelesai(ajukan ? "Isian diajukan ke atasan dan sudah ikut dihitung." : "Draf isian disimpan.");
    } catch (e) {
      setGalat(pesanGalat(e));
    } finally {
      setSibuk(false);
    }
  };

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3" data-editor-isian={indikator.kunci}>
      {terkunci && isian ? (
        <KotakPesan jenis="info">
          Isian ini sudah {STATUS_ISIAN[isian.status].teks.toLowerCase()}. Bila perlu diubah, minta atasan mengembalikannya dahulu.
        </KotakPesan>
      ) : null}
      {isian?.status === "draf" && isian.catatanTinjauan ? (
        <KotakPesan jenis="peringatan">Dikembalikan atasan: {isian.catatanTinjauan}</KotakPesan>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Label>
          Nilai ({indikator.satuan})
          <Input
            type="number"
            inputMode="decimal"
            step="any"
            min={0}
            value={nilai}
            disabled={terkunci || sibuk}
            onChange={(e) => setNilai(e.target.value)}
            aria-label={`Nilai isian ${indikator.teks}`}
            className="h-10"
          />
        </Label>
        <Label>
          Bunyi yang ditampilkan (boleh dikosongkan)
          <Input
            value={nilaiTeks}
            disabled={terkunci || sibuk}
            onChange={(e) => setNilaiTeks(e.target.value)}
            aria-label="Bunyi nilai yang ditampilkan"
            className="h-10"
            maxLength={120}
          />
        </Label>
      </div>
      <Label>
        Catatan
        <Textarea
          value={catatan}
          disabled={terkunci || sibuk}
          onChange={(e) => setCatatan(e.target.value)}
          aria-label="Catatan isian"
          className="min-h-[72px]"
          maxLength={2000}
        />
      </Label>

      <fieldset className="flex flex-col gap-2" disabled={terkunci || sibuk}>
        <legend className="mb-1 text-xs font-medium text-muted-foreground">
          Bukti dukung (wajib minimal satu sebelum diajukan)
        </legend>
        {bukti.length === 0 ? <p className="text-xs text-muted-foreground">Belum ada bukti.</p> : null}
        {bukti.map((b, i) => (
          <div key={i} className="grid gap-2 rounded-lg border border-border bg-card p-2 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_9.5rem_auto]">
            <Input
              value={b.judul}
              onChange={(e) => ubahBukti(i, { judul: e.target.value })}
              placeholder="Judul bukti, mis. Laporan bulanan"
              aria-label={`Judul bukti ${i + 1}`}
              className="h-10"
            />
            <Input
              value={b.rujukan}
              onChange={(e) => ubahBukti(i, { rujukan: e.target.value })}
              placeholder="Tautan atau nomor bukti (boleh kosong)"
              aria-label={`Tautan bukti ${i + 1}`}
              className="h-10"
            />
            <Input
              type="date"
              value={b.tanggal}
              onChange={(e) => ubahBukti(i, { tanggal: e.target.value })}
              aria-label={`Tanggal bukti ${i + 1}`}
              className="h-10"
            />
            <Button type="button" size="sm" variant="ghost" onClick={() => setBukti((x) => x.filter((_, j) => j !== i))} aria-label={`Hapus bukti ${i + 1}`}>
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        ))}
        <div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setBukti((x) => [...x, { judul: "", rujukan: "", tanggal: "" }])}
            disabled={bukti.length >= 20}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Tambah bukti
          </Button>
        </div>
      </fieldset>

      {galat ? <KotakPesan jenis="galat">{galat}</KotakPesan> : null}

      <div className="flex flex-wrap gap-2">
        {!terkunci ? (
          <>
            <Button type="button" size="sm" variant="outline" disabled={sibuk} onClick={() => void jalankan(false)}>
              Simpan draf
            </Button>
            <Button type="button" size="sm" disabled={sibuk} onClick={() => void jalankan(true)}>
              Ajukan ke atasan
            </Button>
          </>
        ) : null}
        <Button type="button" size="sm" variant="ghost" disabled={sibuk} onClick={onTutup}>
          Tutup
        </Button>
      </div>
    </div>
  );
}

// ─── Baris indikator ─────────────────────────────────────────────────────────

function BarisIndikator({
  indikator,
  rhk,
  isian,
  bolehIsi,
  pegawaiUserId,
  tahun,
  periode,
  onSelesai,
}: {
  indikator: IndikatorSkp;
  rhk: RhkSkp;
  isian: IsianManualSkp | null;
  bolehIsi: boolean;
  pegawaiUserId: string;
  tahun: number;
  periode: KunciPeriodeSkpJabatan;
  onSelesai: (pesan: string) => void;
}) {
  const [buka, setBuka] = useState(false);
  // Isian hanya untuk yang tidak terbaca dari SIPP atau memang bersumber isian.
  const dapatDiisi = bolehIsi && (indikator.sumber !== "sipp" || indikator.realisasi === null);
  const catatanTampil = indikator.catatan.filter((c) => c !== "isian" && c !== "sipp");

  return (
    <li className="px-3 py-3" data-indikator={indikator.kunci}>
      <div className="grid gap-2 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,0.7fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
            <Badge variant="outline">{indikator.aspek}</Badge>
            <span>{indikator.teks}</span>
          </p>
          {indikator.dasar ? <p className="mt-1 text-xs text-muted-foreground">{indikator.dasar}</p> : null}
          {catatanTampil.map((c) => (
            <p key={c} className="mt-0.5 text-xs text-muted-foreground">
              {c}
            </p>
          ))}
        </div>
        <div className="text-sm">
          <p className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground lg:hidden">Target</p>
          <p className="font-medium tabular-nums">{indikator.targetTeks || "Belum ada target"}</p>
          {indikator.statusTarget === "usulan" ? (
            <Badge variant="muted" className="mt-1">
              usulan
            </Badge>
          ) : null}
        </div>
        <div className="text-sm">
          <p className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground lg:hidden">Realisasi</p>
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold tabular-nums" aria-label={`Realisasi ${indikator.teks}`}>
              {indikator.realisasi === null ? "—" : indikator.realisasiTeks || String(indikator.realisasi)}
            </span>
            <TandaSumber sumber={indikator.sumber} />
          </p>
          {indikator.pembilang !== null && indikator.penyebut !== null && indikator.penyebut !== 0 ? (
            <p className="text-xs text-muted-foreground tabular-nums">
              {indikator.pembilang.toLocaleString("id-ID")} dari {indikator.penyebut.toLocaleString("id-ID")}
            </p>
          ) : null}
          {isian ? (
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <Badge variant={STATUS_ISIAN[isian.status].variant}>{STATUS_ISIAN[isian.status].teks}</Badge>
              <span>{STATUS_ISIAN[isian.status].arti}</span>
            </p>
          ) : null}
          {dapatDiisi ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2"
              aria-expanded={buka}
              aria-label={`${isian ? "Buka isian" : "Isi manual"} ${indikator.teks}`}
              onClick={() => setBuka((b) => !b)}
            >
              {buka ? <ChevronUp className="h-3.5 w-3.5" aria-hidden /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden />}
              {isian ? "Lihat / ubah isian" : "Isi manual"}
            </Button>
          ) : null}
        </div>
      </div>
      {buka && dapatDiisi ? (
        <EditorIsian
          indikator={indikator}
          rhk={rhk}
          isian={isian}
          pegawaiUserId={pegawaiUserId}
          tahun={tahun}
          periode={periode}
          onTutup={() => setBuka(false)}
          onSelesai={(pesan) => {
            setBuka(false);
            onSelesai(pesan);
          }}
        />
      ) : null}
    </li>
  );
}

function BlokRhk({
  rhk,
  isian,
  bolehIsi,
  pegawaiUserId,
  tahun,
  periode,
  onSelesai,
  tambahan,
}: {
  rhk: RhkSkp;
  isian: IsianManualSkp[];
  bolehIsi: boolean;
  pegawaiUserId: string;
  tahun: number;
  periode: KunciPeriodeSkpJabatan;
  onSelesai: (pesan: string) => void;
  tambahan?: boolean;
}) {
  return (
    <Card className="overflow-hidden" data-rhk={rhk.kunci}>
      <CardHeader className="pb-2">
        <CardDescription className="uppercase tracking-[0.14em]">
          {tambahan ? "Tugas tambahan" : "Rencana Hasil Kerja"}
        </CardDescription>
        <CardTitle className="text-base leading-snug">{rhk.teks}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="flex flex-col divide-y divide-border border-t border-border" aria-label={`Indikator ${rhk.teks}`}>
          {rhk.indikator.map((ind) => (
            <BarisIndikator
              key={ind.kunci}
              indikator={ind}
              rhk={rhk}
              isian={isian.find((i) => i.kunciRhk === rhk.kunci && i.kunciIndikator === ind.kunci) ?? null}
              bolehIsi={bolehIsi}
              pegawaiUserId={pegawaiUserId}
              tahun={tahun}
              periode={periode}
              onSelesai={onSelesai}
            />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ─── Tinjauan isian oleh atasan ──────────────────────────────────────────────

function PanelTinjau({
  data,
  onSelesai,
}: {
  data: JawabanLembarSkp;
  onSelesai: (pesan: string) => void;
}) {
  const menunggu = data.isian.filter((i) => i.status === "diajukan");
  const [catatan, setCatatan] = useState<Record<string, string>>({});
  const [sibuk, setSibuk] = useState<string | null>(null);
  const [galat, setGalat] = useState("");
  const semuaIndikator = [...data.lembar.rhk, ...data.lembar.blokTambahan].flatMap((r) =>
    r.indikator.map((i) => ({ rhk: r.kunci, indikator: i }))
  );

  if (menunggu.length === 0) return null;

  const putuskan = async (isian: IsianManualSkp, aksi: "setujui" | "kembalikan") => {
    setSibuk(isian.id);
    setGalat("");
    try {
      if (aksi === "kembalikan" && !(catatan[isian.id] ?? "").trim()) {
        throw new Error("Tulis alasan pengembalian lebih dahulu.");
      }
      await ambilSkp("/api/skp/isian", { metode: "POST", badan: { aksi, id: isian.id, catatan: (catatan[isian.id] ?? "").trim() } });
      onSelesai(aksi === "setujui" ? "Isian disetujui." : "Isian dikembalikan ke pegawai.");
    } catch (e) {
      setGalat(pesanGalat(e));
    } finally {
      setSibuk(null);
    }
  };

  return (
    <Card className="border-amber-500/40" aria-label="Isian menunggu tinjauan">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Isian menunggu persetujuan Anda</CardTitle>
        <CardDescription>
          {menunggu.length} isian diajukan {data.pegawai.nama}. Periksa angka dan buktinya, lalu setujui atau kembalikan.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {galat ? <KotakPesan jenis="galat">{galat}</KotakPesan> : null}
        {menunggu.map((i) => {
          const nama = semuaIndikator.find((x) => x.rhk === i.kunciRhk && x.indikator.kunci === i.kunciIndikator)?.indikator.teks ?? "Indikator";
          return (
            <div key={i.id} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3" data-isian-id={i.id}>
              <p className="text-sm font-medium">{nama}</p>
              <p className="text-sm">
                Nilai: <span className="font-semibold tabular-nums">{i.nilaiTeks || (i.nilai === null ? "—" : String(i.nilai))}</span>
              </p>
              {i.catatan ? <p className="text-xs text-muted-foreground">Catatan: {i.catatan}</p> : null}
              <ul className="list-disc pl-5 text-xs text-muted-foreground">
                {i.bukti.map((b, n) => (
                  <li key={n}>
                    {b.judul}
                    {b.rujukan ? ` - ${b.rujukan}` : ""}
                    {b.tanggal ? ` (${tanggalPanjang(b.tanggal, b.tanggal)})` : ""}
                  </li>
                ))}
              </ul>
              <Textarea
                value={catatan[i.id] ?? ""}
                onChange={(e) => setCatatan((c) => ({ ...c, [i.id]: e.target.value }))}
                placeholder="Alasan (wajib bila dikembalikan)"
                aria-label={`Catatan tinjauan ${nama}`}
                className="min-h-[56px]"
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" disabled={sibuk === i.id} onClick={() => void putuskan(i, "setujui")}>
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  Setujui
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={sibuk === i.id} onClick={() => void putuskan(i, "kembalikan")}>
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                  Kembalikan
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ─── Pemilih periode ─────────────────────────────────────────────────────────

export function PemilihPeriodeSkp({
  tahun,
  periode,
  onUbah,
}: {
  tahun: number;
  periode: KunciPeriodeSkpJabatan;
  onUbah: (tahun: number, periode: KunciPeriodeSkpJabatan) => void;
}) {
  const hariIni = hariIniWita();
  const tahunIni = Number(hariIni.slice(0, 4));
  const mode = modeDariKunci(periode);
  const pilihanTahun = Array.from({ length: 5 }, (_, i) => tahunIni - i);
  if (!pilihanTahun.includes(tahun)) pilihanTahun.push(tahun);

  const gantiMode = (m: ModePeriodeSkp) => {
    if (m === mode) return;
    const bawaan = bulanSelesaiTerakhir(hariIni);
    if (m === "bulan") {
      const k = tahun === bawaan.tahun ? bawaan.periode : periodeSahUntukTahun("b12", tahun, hariIni);
      onUbah(tahun, k);
    } else if (m === "triwulan") onUbah(tahun, periodeSahUntukTahun("tw4", tahun, hariIni));
    else onUbah(tahun, "tahun");
  };

  return (
    <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Periode SKP">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Periode</span>
        <div className="inline-flex rounded-lg border border-border bg-card p-0.5" role="radiogroup" aria-label="Jenis periode">
          {(
            [
              ["bulan", "Bulanan"],
              ["triwulan", "Triwulan"],
              ["tahun", "Tahunan"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => gantiMode(m)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                mode === m ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {mode === "bulan" ? (
        <Label>
          Bulan
          <NativeSelect
            aria-label="Bulan SKP"
            value={periode}
            onChange={(e) => onUbah(tahun, e.target.value as KunciPeriodeSkpJabatan)}
            className="h-10 min-w-[9rem]"
          >
            {NAMA_BULAN.map((nama, i) => {
              const k = kunciBulan(i + 1);
              return (
                <option key={k} value={k} disabled={mulaiPeriodeSkpJabatan(k, tahun) > hariIni}>
                  {nama}
                </option>
              );
            })}
          </NativeSelect>
        </Label>
      ) : null}
      {mode === "triwulan" ? (
        <Label>
          Triwulan
          <NativeSelect
            aria-label="Triwulan SKP"
            value={periode}
            onChange={(e) => onUbah(tahun, e.target.value as KunciPeriodeSkpJabatan)}
            className="h-10 min-w-[9rem]"
          >
            {PILIHAN_TRIWULAN.map((t) => (
              <option key={t.kunci} value={t.kunci} disabled={mulaiPeriodeSkpJabatan(t.kunci, tahun) > hariIni}>
                {t.label}
              </option>
            ))}
          </NativeSelect>
        </Label>
      ) : null}
      <Label>
        Tahun
        <NativeSelect
          aria-label="Tahun SKP"
          value={String(tahun)}
          onChange={(e) => {
            const baru = Number(e.target.value);
            onUbah(baru, periodeSahUntukTahun(periode, baru, hariIni));
          }}
          className="h-10 min-w-[6.5rem]"
        >
          {pilihanTahun.map((t) => (
            <option key={t} value={String(t)}>
              {t}
            </option>
          ))}
        </NativeSelect>
      </Label>
    </div>
  );
}

// ─── Lembar ──────────────────────────────────────────────────────────────────

export function LembarSkpPegawai({
  pegawaiUserId,
  jenisTersedia,
  sendiri,
}: {
  /** Pegawai yang dibuka. */
  pegawaiUserId: string;
  /** Jenis SKP pegawai itu (SKP Hakim tidak dibuka di sini). */
  jenisTersedia: JenisSkp[];
  /** true = layar SKP Saya (kalimat orang pertama). */
  sendiri?: boolean;
}) {
  // Kunci teks: induk boleh membuat daftar baru tiap render tanpa memicu muat ulang.
  const kunciJenis = jenisTersedia.filter((j) => j !== "hakim").join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const jenisLayar: JenisSkp[] = useMemo(() => jenisTersedia.filter((j) => j !== "hakim"), [kunciJenis]);
  const bawaan = useMemo(() => bulanSelesaiTerakhir(hariIniWita()), []);
  const [jenisPilih, setJenisPilih] = useState<JenisSkp | null>(null);
  // Pilihan yang tidak lagi tersedia (jabatan berubah) jatuh ke jenis pertama.
  const jenis: JenisSkp | null = jenisPilih && jenisLayar.includes(jenisPilih) ? jenisPilih : (jenisLayar[0] ?? null);
  const [tahun, setTahun] = useState(bawaan.tahun);
  const [periode, setPeriode] = useState<KunciPeriodeSkpJabatan>(bawaan.periode);
  const [tambahan, setTambahan] = useState(true);
  const [kabar, setKabar] = useState("");
  const [ulang, setUlang] = useState(0);
  const { sibuk, kabar: kabarUnduh, unduh } = useUnduhSkp();

  let alamat: string | null = null;
  if (jenis) {
    const kueri = new URLSearchParams({ jenis, pegawai: pegawaiUserId, tahun: String(tahun), periode });
    if (!tambahan) kueri.set("tambahan", "0");
    alamat = `/api/skp/lembar?${kueri.toString()}`;
  }
  // Grup = pegawai + jenis: hasil pegawai/jenis lain tidak boleh terbawa saat memuat.
  const { data, galat, memuat } = useAmbilSkp<JawabanLembarSkp>(alamat, `${pegawaiUserId}|${jenis ?? ""}`, ulang);

  if (jenisLayar.length === 0) {
    return (
      <KotakPesan jenis="info">
        {sendiri ? "Jabatan Anda " : "Jabatan pegawai ini "}
        belum memiliki SKP jabatan di layar ini. SKP Hakim diunduh dari menu &quot;Unduh eviden SKP&quot; di halaman Rekap Hakim.
        Bila jabatan belum benar, minta Panitera atau administrator memeriksanya di tab Pemetaan.
      </KotakPesan>
    );
  }

  const lembar = data?.lembar ?? null;
  const adaTambahan = (data?.pegawai.jabatanTambahan.length ?? 0) > 0 || (lembar?.blokTambahan.length ?? 0) > 0;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-3 py-4">
          <div className="flex flex-wrap items-end gap-3">
            {jenisLayar.length > 1 ? (
              <Label>
                Jenis SKP
                <NativeSelect
                  aria-label="Jenis SKP"
                  value={jenis ?? ""}
                  onChange={(e) => setJenisPilih(e.target.value as JenisSkp)}
                  className="h-10 min-w-[12rem]"
                >
                  {jenisLayar.map((j) => (
                    <option key={j} value={j}>
                      {namaJenisSkp(j)}
                    </option>
                  ))}
                </NativeSelect>
              </Label>
            ) : null}
            <PemilihPeriodeSkp
              tahun={tahun}
              periode={periode}
              onUbah={(t, p) => {
                setTahun(t);
                setPeriode(p);
              }}
            />
            {adaTambahan && jenis !== "pimpinan" ? (
              <label className="flex items-center gap-2 pb-2 text-sm">
                <input
                  type="checkbox"
                  checked={tambahan}
                  onChange={(e) => setTambahan(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                Sertakan tugas tambahan
              </label>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {kabar ? <KotakPesan jenis="ok">{kabar}</KotakPesan> : null}
      {galat ? <KotakPesan jenis="galat">{galat}</KotakPesan> : null}
      {memuat && !data ? <Memuat teks="Menyusun SKP dari SIPP… hitungan pertama dapat memakan beberapa detik." /> : null}

      {data && lembar ? (
        <div className={cn("flex flex-col gap-4", memuat && "opacity-60")} aria-busy={memuat || undefined}>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="uppercase tracking-[0.14em]">
                {namaJenisSkp(data.jenis)} · {labelPeriode(periode, tahun)}
              </CardDescription>
              <CardTitle className="text-xl">{data.pegawai.nama}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 xl:grid-cols-4">
              <p>
                <span className="text-muted-foreground">NIP: </span>
                {data.pegawai.nip ?? "belum tercatat"}
              </p>
              <p>
                <span className="text-muted-foreground">Pangkat/golongan: </span>
                {data.pegawai.pangkatGolongan ?? "belum tercatat"}
              </p>
              <p>
                <span className="text-muted-foreground">Jabatan: </span>
                {namaJabatan(data.pegawai.jabatanUtama)}
                {data.pegawai.jabatanTambahan.length > 0
                  ? ` (+ ${data.pegawai.jabatanTambahan.map((j) => namaJabatan(j)).join(", ")})`
                  : ""}
              </p>
              <p>
                <span className="text-muted-foreground">Pejabat penilai: </span>
                {lembar.pejabatPenilai?.nama ?? data.penetapan?.pejabatPenilaiNama ?? "belum tercatat"}
              </p>
            </CardContent>
          </Card>

          {!data.sippTerjangkau ? (
            <KotakPesan jenis="peringatan">
              Data SIPP belum dapat dibaca saat ini, sehingga angka yang berasal dari SIPP tampil &quot;—&quot; (bukan nol). Isian manual tetap
              dapat diisi dan diajukan. Coba muat ulang beberapa saat lagi.
            </KotakPesan>
          ) : null}
          {data.dariPenetapan && data.penetapan ? (
            <KotakPesan jenis="info">
              Angka pada layar ini diambil dari penetapan yang {data.penetapan.status === "terkunci" ? "sudah dikunci" : "tersimpan"}
              {data.penetapan.dikunciPada ? ` pada ${tanggalPanjang(data.penetapan.dikunciPada.slice(0, 10), data.penetapan.dikunciPada)}` : ""} dan
              tidak berubah lagi.
            </KotakPesan>
          ) : null}
          {lembar.galat.length > 0 ? (
            <KotakPesan jenis="peringatan">
              <p className="font-medium">Sebagian data tidak terbaca dari SIPP:</p>
              <ul className="mt-1 list-disc pl-4">
                {lembar.galat.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            </KotakPesan>
          ) : null}
          {data.catatanOperator.length > 0 ? (
            <KotakPesan jenis="info">
              <p className="font-medium">Catatan untuk petugas - tidak tercetak di dokumen:</p>
              <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                {data.catatanOperator.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </KotakPesan>
          ) : null}

          {lembar.rhk.map((r) => (
            <BlokRhk
              key={r.kunci}
              rhk={r}
              isian={data.isian}
              bolehIsi={data.hak.bolehUbahIsian}
              pegawaiUserId={data.pegawai.userId}
              tahun={tahun}
              periode={periode}
              onSelesai={(pesan) => {
                setKabar(pesan);
                setUlang((n) => n + 1);
              }}
            />
          ))}
          {lembar.blokTambahan.map((r) => (
            <BlokRhk
              key={`t-${r.kunci}`}
              rhk={r}
              tambahan
              isian={data.isian}
              bolehIsi={data.hak.bolehUbahIsian}
              pegawaiUserId={data.pegawai.userId}
              tahun={tahun}
              periode={periode}
              onSelesai={(pesan) => {
                setKabar(pesan);
                setUlang((n) => n + 1);
              }}
            />
          ))}

          {lembar.catatan.length > 0 ? (
            <ul className="list-disc pl-5 text-xs text-muted-foreground" aria-label="Catatan lembar">
              {lembar.catatan.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          ) : null}

          {data.hak.bolehTinjau ? (
            <PanelTinjau
              data={data}
              onSelesai={(pesan) => {
                setKabar(pesan);
                setUlang((n) => n + 1);
              }}
            />
          ) : null}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Unduh</CardTitle>
              <CardDescription>
                Lembar SKP dan bukti dukungnya, siap diisikan ke e-Kinerja BKN. Tanda tangan pejabat penilai di sebelah kanan.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {data.jenis === "pimpinan" ? (
                <KotakPesan jenis="info">
                  SKP Pimpinan diunduh lengkap bersama eviden hakimnya dari tombol &quot;Unduh eviden SKP&quot; di halaman Rekap Hakim
                  (pilih Jenis SKP: SKP Pimpinan).
                </KotakPesan>
              ) : (
                <>
                  <BarisUnduhSkp
                    judul="Lembar SKP"
                    sibuk={sibuk}
                    onUnduh={(a) => void unduh(a)}
                    alamatDari={(format) =>
                      alamatUnduhLembarSkp({
                        jenis: data.jenis,
                        pegawai: data.pegawai.userId,
                        tahun,
                        periode,
                        dokumen: "lembar-skp",
                        format,
                        sertakanTambahan: tambahan,
                      })
                    }
                  />
                  <div className="border-t border-border pt-3">
                    <BarisUnduhSkp
                      judul="Semua dokumen dan bukti dukung (ZIP)"
                      ikonArsip
                      sibuk={sibuk}
                      onUnduh={(a) => void unduh(a)}
                      alamatDari={(format) =>
                        alamatUnduhLembarSkp({
                          jenis: data.jenis,
                          pegawai: data.pegawai.userId,
                          tahun,
                          periode,
                          dokumen: "semua",
                          format,
                          sertakanTambahan: tambahan,
                        })
                      }
                    />
                  </div>
                </>
              )}
              {kabarUnduh ? <KotakPesan jenis={kabarUnduh.jenis === "ok" ? "ok" : "galat"}>{kabarUnduh.teks}</KotakPesan> : null}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {!memuat && !data && galat ? (
        <div>
          <Button type="button" size="sm" variant="outline" onClick={() => setUlang((n) => n + 1)}>
            Coba lagi
          </Button>
        </div>
      ) : null}
    </div>
  );
}
