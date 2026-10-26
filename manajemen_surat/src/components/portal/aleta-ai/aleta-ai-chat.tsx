"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ListChecks, PanelLeftOpen, Settings2, Sparkles, Wallet } from "lucide-react";

import {
  formatRupiah,
  judulDariTeks,
  labelAman,
  type PesanAi,
  type PeristiwaAlir,
  type RincianPercakapan,
  type RingkasAi,
  type RingkasPercakapan,
  type Pemicu,
} from "@/lib/aleta-ai/kontrak";
import { ambil, kirimJson, kirimPesanAlir } from "@/lib/aleta-ai/klien";
import { cn } from "@/lib/utils";

import { DaftarPesan, Sambutan, type AlirAktif } from "./daftar-pesan";
import { KotakTulis, type PerkiraanTampil } from "./kotak-tulis";
import { RiwayatPercakapan } from "./riwayat-percakapan";

let penghitungLokal = 0;
const idLokal = () => `lokal-${Date.now()}-${++penghitungLokal}`;

function daftarDariData(data: unknown): RingkasPercakapan[] {
  if (Array.isArray(data)) return data as RingkasPercakapan[];
  const d = data as { percakapan?: RingkasPercakapan[]; daftar?: RingkasPercakapan[] } | null;
  return d?.percakapan ?? d?.daftar ?? [];
}

export function LayarNonaktif({ alasan, superAdmin }: { alasan?: string; superAdmin?: boolean }) {
  return (
    <div className="flex min-h-[26rem] items-center justify-center rounded-2xl border border-border/70 bg-card p-6" data-testid="aleta-ai-nonaktif">
      <div className="max-w-md space-y-3 text-center">
        <span aria-hidden="true" className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Sparkles className="size-7" />
        </span>
        <h2 className="font-serif text-2xl">ALETA Ai belum diaktifkan</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          {alasan?.trim() || "Layanan ini belum dibuka untuk Anda. Silakan hubungi admin bila Anda memerlukannya."}
        </p>
        {superAdmin ? (
          <Link
            href="/aleta-ai/pengaturan"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Settings2 className="size-4" aria-hidden="true" /> Buka pengaturan
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function AletaAiChat() {
  const [ringkas, setRingkas] = useState<RingkasAi | null>(null);
  const [galatRingkas, setGalatRingkas] = useState("");
  const [saldoRp, setSaldoRp] = useState(0);
  const [daftar, setDaftar] = useState<RingkasPercakapan[]>([]);
  const [memuatDaftar, setMemuatDaftar] = useState(true);
  const [aktifId, setAktifId] = useState<string | null>(null);
  const [judulAktif, setJudulAktif] = useState("");
  const [pesan, setPesan] = useState<PesanAi[]>([]);
  const [memuatPesan, setMemuatPesan] = useState(false);
  const [alir, setAlir] = useState<AlirAktif | null>(null);
  const [galat, setGalat] = useState("");
  const [status, setStatus] = useState("");
  const [pemicuDipilih, setPemicuDipilih] = useState<string | null>(null);
  const [isianLuar, setIsianLuar] = useState<{ teks: string; nomor: number } | null>(null);
  const [laci, setLaci] = useState(false);
  const [riwayatLebar, setRiwayatLebar] = useState(true);

  const pengendali = useRef<AbortController | null>(null);
  const tokenMuat = useRef(0);
  const sibuk = useRef(false);

  const muatRingkas = useCallback(async () => {
    setGalatRingkas("");
    const r = await ambil<RingkasAi>("/api/aleta-ai/ringkas");
    if (!r.ok) {
      setGalatRingkas(r.galat);
      setRingkas(null);
      return;
    }
    setRingkas(r.data);
    setSaldoRp(r.data.saldoRp ?? 0);
  }, []);

  // Tahap 4: perkiraan biaya sebelum kirim. Gagal/kosong = tidak menampilkan apa-apa (kirim tetap jalan seperti biasa).
  const perkirakan = useCallback(
    async (teks: string, pemicu?: string): Promise<PerkiraanTampil | null> => {
      const r = await kirimJson<Partial<PerkiraanTampil>>("/api/aleta-ai/perkiraan", "POST", { percakapanId: aktifId ?? "", teks, pemicu });
      if (!r.ok || typeof r.data?.perkiraanRp !== "number" || typeof r.data.bolehJalan !== "boolean") return null;
      return { perkiraanRp: r.data.perkiraanRp, label: String(r.data.label ?? ""), bolehJalan: r.data.bolehJalan, alasan: r.data.alasan, gratis: r.data.gratis };
    },
    [aktifId]
  );

  const muatDaftar = useCallback(async () => {
    setMemuatDaftar(true);
    const r = await ambil<unknown>("/api/aleta-ai/percakapan");
    if (r.ok) setDaftar(daftarDariData(r.data));
    setMemuatDaftar(false);
  }, []);

  useEffect(() => {
    void muatRingkas();
    void muatDaftar();
    return () => pengendali.current?.abort();
  }, [muatRingkas, muatDaftar]);

  const pilihPercakapan = useCallback(
    async (id: string) => {
      if (sibuk.current) return;
      const token = ++tokenMuat.current;
      setLaci(false);
      setAktifId(id);
      setGalat("");
      setPesan([]);
      setMemuatPesan(true);
      const r = await ambil<RincianPercakapan>(`/api/aleta-ai/percakapan/${encodeURIComponent(id)}`);
      if (token !== tokenMuat.current) return;
      setMemuatPesan(false);
      if (!r.ok) {
        setGalat(r.galat);
        return;
      }
      setJudulAktif(r.data.judul);
      setPesan(r.data.pesan ?? []);
    },
    []
  );

  function percakapanBaru() {
    if (sibuk.current) return;
    tokenMuat.current += 1;
    setLaci(false);
    setAktifId(null);
    setJudulAktif("");
    setPesan([]);
    setGalat("");
    setStatus("");
    setPemicuDipilih(null);
    setMemuatPesan(false);
  }

  async function ubahNama(id: string, judul: string) {
    const r = await kirimJson<unknown>(`/api/aleta-ai/percakapan/${encodeURIComponent(id)}`, "PATCH", { judul });
    if (!r.ok) {
      setGalat(r.galat);
      return;
    }
    setDaftar((d) => d.map((p) => (p.id === id ? { ...p, judul } : p)));
    if (id === aktifId) setJudulAktif(judul);
  }

  async function sembunyikan(id: string) {
    const r = await kirimJson<unknown>(`/api/aleta-ai/percakapan/${encodeURIComponent(id)}`, "DELETE");
    if (!r.ok) {
      setGalat(r.galat);
      return;
    }
    setDaftar((d) => d.filter((p) => p.id !== id));
    if (id === aktifId) percakapanBaru();
  }

  async function kirim(teks: string, pemicu?: string) {
    const isi = teks.trim();
    if (!isi || sibuk.current) return;
    sibuk.current = true;
    setGalat("");
    setStatus("");
    let id = aktifId;
    if (!id) {
      const judul = judulDariTeks(isi);
      const r = await kirimJson<{ id: string }>("/api/aleta-ai/percakapan", "POST", { judul });
      if (!r.ok) {
        setGalat(r.galat);
        sibuk.current = false;
        return;
      }
      id = r.data.id;
      tokenMuat.current += 1;
      setAktifId(id);
      setJudulAktif(judul);
      setDaftar((d) => [{ id: id as string, judul, diperbarui: new Date().toISOString() }, ...d]);
    }
    const sekarang = new Date().toISOString();
    setPesan((p) => [...p, { id: idLokal(), peran: "pengguna", isi, waktu: sekarang }]);
    setAlir({ teks: "" });
    setStatus("ALETA Ai sedang menyusun jawaban.");

    const pengendaliBaru = new AbortController();
    pengendali.current = pengendaliBaru;
    let kumpul = "";
    let ditangani = false;

    const tutupSebagian = (alasanGalat?: string) => {
      if (ditangani) return;
      ditangani = true;
      if (kumpul) {
        setPesan((p) => [...p, { id: idLokal(), peran: "ai", isi: kumpul, waktu: new Date().toISOString(), terputus: true }]);
      }
      if (alasanGalat) setGalat(alasanGalat);
    };

    const olah = (e: PeristiwaAlir) => {
      if (e.jenis === "perkiraan") {
        setAlir((a) => ({ teks: a?.teks ?? "", perkiraan: { mode: e.mode, label: e.label, perkiraanRp: e.perkiraanRp } }));
      } else if (e.jenis === "teks") {
        kumpul += e.delta;
        setAlir((a) => ({ ...(a ?? { teks: "" }), teks: kumpul }));
      } else if (e.jenis === "alat") {
        setStatus(`Membaca ${e.label || "data"} dari SIPP...`);
      } else if (e.jenis === "selesai") {
        ditangani = true;
        setPesan((p) => [
          ...p,
          { id: e.pesanId, peran: "ai", isi: kumpul, mode: e.mode, label: e.label, biayaRp: e.biayaRp, waktu: new Date().toISOString() },
        ]);
        setSaldoRp(e.saldoRp);
        setDaftar((d) => d.map((x) => (x.id === id ? { ...x, diperbarui: new Date().toISOString() } : x)));
        setStatus(`Jawaban selesai. Mode ${labelAman(e.mode, e.label)}, biaya ${formatRupiah(e.biayaRp)}.`);
      } else if (e.jenis === "gagal") {
        tutupSebagian(e.pesan || "Jawaban belum berhasil dibuat.");
        setStatus("Jawaban gagal.");
      }
    };

    try {
      const hasil = await kirimPesanAlir(id, { teks: isi, pemicu }, olah, pengendaliBaru.signal);
      if (!hasil.selesai) {
        if (hasil.galat === "dihentikan") {
          tutupSebagian();
          setStatus("Jawaban dihentikan.");
        } else {
          tutupSebagian(hasil.galat || "Jawaban belum berhasil dibuat.");
          setStatus("Jawaban gagal.");
        }
      }
    } finally {
      pengendali.current = null;
      setAlir(null);
      sibuk.current = false;
    }
  }

  function hentikan() {
    pengendali.current?.abort();
  }

  function pilihPemicuDariSambutan(p: Pemicu) {
    setPemicuDipilih(p.kode);
  }

  if (galatRingkas && !ringkas) {
    return (
      <div className="flex min-h-[26rem] items-center justify-center rounded-2xl border border-border/70 bg-card p-6" data-testid="aleta-ai-galat-ringkas">
        <div className="max-w-md space-y-3 text-center">
          <h2 className="font-serif text-2xl">ALETA Ai belum dapat dibuka</h2>
          <p className="text-sm leading-6 text-muted-foreground">{galatRingkas}</p>
          <button
            type="button"
            onClick={() => void muatRingkas()}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-card px-4 text-sm font-semibold hover:bg-accent/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Coba lagi
          </button>
        </div>
      </div>
    );
  }

  if (!ringkas) {
    return (
      <div role="status" className="flex min-h-[26rem] items-center justify-center rounded-2xl border border-border/70 bg-card text-sm text-muted-foreground">
        Membuka ALETA Ai...
      </div>
    );
  }

  if (!ringkas.aktif) {
    return <LayarNonaktif alasan={ringkas.alasanNonaktif} superAdmin={ringkas.superAdmin} />;
  }

  const kosong = pesan.length === 0 && !alir && !memuatPesan;

  return (
    <div className="relative flex h-[calc(100dvh-9rem)] min-h-[34rem] overflow-hidden rounded-2xl border border-border/70 bg-card shadow-panel" data-testid="aleta-ai-chat">
      {laci ? <div className="fixed inset-0 z-30 tirai-latar lg:hidden" aria-hidden="true" onClick={() => setLaci(false)} /> : null}
      <RiwayatPercakapan
        className={cn(
          laci ? "fixed inset-y-0 left-0 z-40 flex w-[min(20rem,88vw)] shadow-panel" : "hidden",
          riwayatLebar ? "lg:static lg:z-auto lg:flex lg:w-72 lg:shadow-none xl:w-80" : "lg:hidden"
        )}
        daftar={daftar}
        memuat={memuatDaftar}
        aktifId={aktifId}
        onPilih={(id) => void pilihPercakapan(id)}
        onBaru={percakapanBaru}
        onUbahNama={ubahNama}
        onSembunyikan={sembunyikan}
        onTutup={() => {
          setLaci(false);
          setRiwayatLebar(false);
        }}
      />

      <section className="flex min-w-0 flex-1 flex-col" aria-label="Percakapan ALETA Ai">
        <header className="flex items-center gap-2 border-b border-border/60 px-3 py-2 sm:px-4">
          <button
            type="button"
            onClick={() => setLaci(true)}
            aria-label="Buka riwayat"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
          >
            <PanelLeftOpen className="size-5" aria-hidden="true" />
          </button>
          {!riwayatLebar ? (
            <button
              type="button"
              onClick={() => setRiwayatLebar(true)}
              aria-label="Buka riwayat"
              className="hidden size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:inline-flex"
            >
              <PanelLeftOpen className="size-5" aria-hidden="true" />
            </button>
          ) : null}
          <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-primary">
            <Sparkles className="size-4" aria-hidden="true" /> ALETA Ai
          </span>
          <h2 className="min-w-0 flex-1 truncate text-center text-sm font-medium text-foreground sm:text-left" data-testid="judul-percakapan">
            {judulAktif ? <span className="text-muted-foreground">/ </span> : null}
            {judulAktif || ""}
          </h2>
          <Link
            href="/aleta-ai/tugas"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border/80 bg-background/60 px-2.5 text-sm font-medium hover:bg-accent/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title="Tugas bertahap dan berkas hasil"
          >
            <ListChecks className="size-4 text-muted-foreground" aria-hidden="true" />
            <span className="hidden sm:inline">Tugas</span>
            <span className="sr-only sm:hidden">Tugas</span>
          </Link>
          <Link
            href="/aleta-ai/saldo"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border/80 bg-background/60 px-2.5 text-sm font-medium hover:bg-accent/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title="Lihat saldo dan mutasi"
          >
            <Wallet className="size-4 text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Saldo </span>
            <span data-testid="saldo-kepala" className="tabular-nums">
              {formatRupiah(saldoRp)}
            </span>
          </Link>
          {ringkas.superAdmin ? (
            <Link
              href="/aleta-ai/pengaturan"
              aria-label="Pengaturan ALETA Ai"
              title="Pengaturan"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Settings2 className="size-4" aria-hidden="true" />
            </Link>
          ) : null}
        </header>

        {kosong ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {galat ? (
              <p role="alert" className="mx-auto mt-4 max-w-3xl rounded-xl border border-amber-300/70 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                {galat}
              </p>
            ) : null}
            <Sambutan
              pemicu={ringkas.pemicu}
              onContoh={(teks) => setIsianLuar({ teks, nomor: (isianLuar?.nomor ?? 0) + 1 })}
              onPemicu={pilihPemicuDariSambutan}
            />
          </div>
        ) : (
          <DaftarPesan
            pesan={pesan}
            alir={alir}
            memuat={memuatPesan}
            galat={galat}
            status={status}
            onUlangi={(teks) => void kirim(teks)}
          />
        )}

        <KotakTulis
          pemicu={ringkas.pemicu}
          mengalir={alir !== null}
          dipilih={pemicuDipilih}
          onPilihPemicu={setPemicuDipilih}
          onKirim={(teks, pemicu) => void kirim(teks, pemicu)}
          onHentikan={hentikan}
          saldoKurang={!ringkas.superAdmin && saldoRp < Math.max(1000, ringkas.ambangSaldoMenipisRp ?? 0)}
          isianLuar={isianLuar}
          perkirakan={perkirakan}
        />
      </section>
    </div>
  );
}
