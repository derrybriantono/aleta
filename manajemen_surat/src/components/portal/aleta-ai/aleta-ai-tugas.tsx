"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CircleAlert, Download, Loader2, Pause, Play, Send } from "lucide-react";

import { apiPath } from "@/lib/base-path";
import { ambil, kirimJson } from "@/lib/aleta-ai/klien";
import { formatRupiah } from "@/lib/aleta-ai/kontrak";
import { TANDA_DRAF } from "@/lib/aleta-ai/tugas";
import { cn } from "@/lib/utils";

/**
 * ALETA Ai tahap 3 - layar TUGAS (cowork). Status dibaca dari server (tabel),
 * jadi halaman boleh ditutup: tugas tetap berjalan dan tampil lagi saat dibuka.
 * Semua penjagaan (hak per peran, saldo, saklar) ada di server; tombol yang
 * tidak berhak hanya dinonaktifkan untuk kerapian.
 */

type JenisPilihan = { jenis: string; label: string; boleh: boolean; alasan: string; tujuan: Array<{ tujuan: string; label: string }> };
type Langkah = { kode: string; judul: string; status: string; catatan: string; model: string; effort: string; token: number; ringkas: string };
type Berkas = { id: string; nama: string; format: string; ukuran: number; templat: string };
type Tugas = {
  id: string;
  jenis: string;
  judul: string;
  nomorPerkara: string;
  format: string;
  status: string;
  pesan: string;
  mode: string;
  biayaRp: number;
  terputus: boolean;
  langkah?: Langkah[];
  berkas?: Berkas[];
};
type DataTugas = { tugas: Tugas[]; jenis: JenisPilihan[]; format: string[]; alatBantu: { aktif: boolean } };
type Kiriman = { id: string; label: string; status: string; nilai: { teks?: string; isian?: Record<string, string> } };

const LABEL_STATUS: Record<string, string> = {
  antre: "Antre",
  berjalan: "Berjalan",
  dijeda: "Dijeda",
  dihentikan: "Dihentikan (saklar)",
  gagal: "Gagal",
  selesai: "Selesai",
  menunggu: "Menunggu",
  dilewati: "Dilewati",
};

const WARNA_STATUS: Record<string, string> = {
  selesai: "text-emerald-700 dark:text-emerald-300",
  berjalan: "text-primary",
  gagal: "text-destructive",
  dihentikan: "text-amber-700 dark:text-amber-300",
  dijeda: "text-amber-700 dark:text-amber-300",
};

export function AletaAiTugas() {
  const [data, setData] = useState<DataTugas | null>(null);
  const [galat, setGalat] = useState("");
  const [pilih, setPilih] = useState<string | null>(null);
  const [rinci, setRinci] = useState<Tugas | null>(null);
  const [form, setForm] = useState({ jenis: "", nomorPerkara: "", instruksi: "", format: "docx" });
  const [sibuk, setSibuk] = useState(false);
  const [usulan, setUsulan] = useState<Kiriman | null>(null);

  const muat = useCallback(async () => {
    const r = await ambil<DataTugas>("/api/aleta-ai/tugas");
    if (r.ok) {
      setData(r.data);
      setForm((f) => (f.jenis ? f : { ...f, jenis: r.data.jenis.find((j) => j.boleh)?.jenis ?? "" }));
    } else setGalat(r.galat);
  }, []);

  const muatRinci = useCallback(async (id: string) => {
    const r = await ambil<Tugas>(`/api/aleta-ai/tugas/${encodeURIComponent(id)}`);
    if (r.ok) setRinci(r.data);
    else setGalat(r.galat);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void muat(), 0);
    return () => clearTimeout(t);
  }, [muat]);

  // Status dari server (tabel tugas): dibaca segera lalu tiap 3 detik selama tugas terpilih.
  useEffect(() => {
    if (!pilih) return;
    const awal = setTimeout(() => void muatRinci(pilih), 0);
    const t = setInterval(() => void muatRinci(pilih), 3000);
    return () => {
      clearTimeout(awal);
      clearInterval(t);
    };
  }, [pilih, muatRinci]);

  const buat = async () => {
    setSibuk(true);
    setGalat("");
    const r = await kirimJson<{ id: string }>("/api/aleta-ai/tugas", "POST", { ...form, mulai: true });
    setSibuk(false);
    if (!r.ok) return setGalat(r.galat);
    setForm((f) => ({ ...f, instruksi: "" }));
    setPilih(r.data.id);
    void muat();
  };

  const aksi = async (id: string, nama: "hentikan" | "lanjutkan") => {
    setGalat("");
    const r = await kirimJson<Tugas>(`/api/aleta-ai/tugas/${encodeURIComponent(id)}`, "POST", { aksi: nama });
    if (!r.ok) setGalat(r.galat);
    void muatRinci(id);
    void muat();
  };

  const usulkan = async (id: string, tujuan: string) => {
    setGalat("");
    const r = await kirimJson<Kiriman>(`/api/aleta-ai/tugas/${encodeURIComponent(id)}/kirim`, "POST", { tujuan });
    if (r.ok) setUsulan(r.data);
    else setGalat(r.galat);
  };

  const putuskan = async (setuju: boolean) => {
    if (!usulan) return;
    const r = await kirimJson<Kiriman>(`/api/aleta-ai/kiriman/${encodeURIComponent(usulan.id)}`, "POST", { setuju });
    if (!r.ok) setGalat(r.galat);
    setUsulan(null);
  };

  const jenisAktif = data?.jenis.find((j) => j.jenis === rinci?.jenis);

  return (
    <div className="space-y-5" data-testid="aleta-ai-tugas">
      <Link href="/aleta-ai" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <ArrowLeft className="size-4" aria-hidden="true" /> Kembali ke ALETA Ai
      </Link>

      {galat ? (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-amber-300/70 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {galat}
        </p>
      ) : null}
      {!data && !galat ? (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Memuat tugas...
        </p>
      ) : null}

      {data ? (
        <div className="grid gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <div className="space-y-4">
            <form
              className="space-y-3 rounded-2xl border border-border/80 bg-card p-4 shadow-sm"
              onSubmit={(e) => {
                e.preventDefault();
                void buat();
              }}
              aria-label="Tugas baru"
            >
              <p className="text-sm font-semibold">Tugas baru</p>
              <label className="block text-sm">
                Jenis tugas
                <select
                  className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
                  value={form.jenis}
                  onChange={(e) => setForm({ ...form, jenis: e.target.value })}
                >
                  {data.jenis.map((j) => (
                    <option key={j.jenis} value={j.jenis} disabled={!j.boleh} title={j.alasan}>
                      {j.label}
                      {j.boleh ? "" : " (tidak berhak)"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Nomor perkara
                <input
                  className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
                  value={form.nomorPerkara}
                  onChange={(e) => setForm({ ...form, nomorPerkara: e.target.value })}
                  placeholder="mis. 101/Pdt.G/2026/PA.Dgl"
                />
              </label>
              <label className="block text-sm">
                Instruksi
                <textarea
                  className="mt-1 min-h-24 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                  value={form.instruksi}
                  onChange={(e) => setForm({ ...form, instruksi: e.target.value })}
                />
              </label>
              <label className="block text-sm">
                Format berkas
                <select className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2 text-sm" value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })}>
                  {data.format.map((f) => (
                    <option key={f} value={f}>
                      {f.toUpperCase()}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                disabled={sibuk || !form.jenis}
                className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Play className="size-4" aria-hidden="true" /> Mulai tugas
              </button>
              <p className="text-xs text-muted-foreground">Perkiraan biaya ditahan dari saldo saat tugas berjalan; yang dipotong hanya pemakaian sebenarnya.</p>
            </form>

            <ul className="space-y-1.5" aria-label="Daftar tugas">
              {data.tugas.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setPilih(t.id)}
                    className={cn("w-full rounded-xl border border-border/70 bg-card px-3 py-2 text-left text-sm hover:bg-accent/60", pilih === t.id && "border-primary")}
                  >
                    <span className="block truncate font-medium">{t.judul}</span>
                    <span className={cn("text-xs", WARNA_STATUS[t.status])}>
                      {t.terputus ? "Terputus - dapat dilanjutkan" : LABEL_STATUS[t.status] ?? t.status} · {formatRupiah(t.biayaRp)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {rinci ? (
            <section className="space-y-4 rounded-2xl border border-border/80 bg-card p-4 shadow-sm" aria-label="Rincian tugas" data-testid="rincian-tugas">
              <header className="flex flex-wrap items-center gap-2">
                <h2 className="min-w-0 flex-1 truncate text-base font-semibold">{rinci.judul}</h2>
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs">Mode: {rinci.mode}</span>
                {rinci.status === "berjalan" && !rinci.terputus ? (
                  <button type="button" onClick={() => void aksi(rinci.id, "hentikan")} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-sm hover:bg-accent/70">
                    <Pause className="size-4" aria-hidden="true" /> Hentikan
                  </button>
                ) : null}
                {rinci.status !== "selesai" && (rinci.status !== "berjalan" || rinci.terputus) ? (
                  <button type="button" onClick={() => void aksi(rinci.id, "lanjutkan")} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-sm hover:bg-accent/70">
                    <Play className="size-4" aria-hidden="true" /> Lanjutkan
                  </button>
                ) : null}
              </header>
              {rinci.pesan ? <p className="text-sm text-muted-foreground">{rinci.pesan}</p> : null}

              <ol className="space-y-2" aria-label="Langkah tugas">
                {(rinci.langkah ?? []).map((l, i) => (
                  <li key={l.kode} className="rounded-xl border border-border/60 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium">
                        {i + 1}. {l.judul}
                      </span>
                      <span className={cn("text-xs", WARNA_STATUS[l.status])}>{LABEL_STATUS[l.status] ?? l.status}</span>
                      {l.token ? <span className="text-xs tabular-nums text-muted-foreground">{l.token.toLocaleString("id-ID")} token</span> : null}
                    </div>
                    {l.catatan ? <p className="mt-1 text-xs text-muted-foreground">{l.catatan}</p> : null}
                    {l.ringkas && l.kode !== "ambil-data" ? (
                      <details className="mt-1 text-sm">
                        <summary className="cursor-pointer text-xs text-primary">Lihat hasil langkah</summary>
                        <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-words font-sans text-sm">{l.ringkas}</pre>
                      </details>
                    ) : null}
                  </li>
                ))}
              </ol>

              {rinci.berkas?.length ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Berkas</p>
                  <p className="text-xs text-destructive">{TANDA_DRAF}. Rujukan bertanda [perlu verifikasi] wajib dicek sebelum dipakai.</p>
                  <ul className="flex flex-wrap gap-2">
                    {rinci.berkas.map((b) => (
                      <li key={b.id}>
                        <a
                          href={apiPath(`/api/aleta-ai/tugas/${encodeURIComponent(rinci.id)}/berkas/${encodeURIComponent(b.id)}`)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-sm hover:bg-accent/70"
                        >
                          <Download className="size-4" aria-hidden="true" /> {b.format.toUpperCase()}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {rinci.status === "selesai" && jenisAktif?.tujuan.length ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Kirim ke alur</p>
                  <div className="flex flex-wrap gap-2">
                    {jenisAktif.tujuan.map((t) => (
                      <button key={t.tujuan} type="button" onClick={() => void usulkan(rinci.id, t.tujuan)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-sm hover:bg-accent/70">
                        <Send className="size-4" aria-hidden="true" /> {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      ) : null}

      {usulan ? (
        <div role="dialog" aria-modal="true" aria-label="Konfirmasi kiriman" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[85vh] w-full max-w-2xl space-y-3 overflow-auto rounded-2xl border border-border bg-card p-4 shadow-lg">
            <p className="text-sm font-semibold">Kirim ke {usulan.label}?</p>
            <p className="text-xs text-muted-foreground">Periksa isi di bawah. Nilai ini baru masuk ke alur sesudah Anda menekan &quot;Ya, kirim&quot;; menyimpan ke SIPP/ABT tetap dilakukan petugas di alur itu.</p>
            <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted p-3 font-sans text-sm">
              {usulan.nilai.teks ?? Object.entries(usulan.nilai.isian ?? {}).map(([k, v]) => `${k}: ${v}`).join("\n")}
            </pre>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => void putuskan(false)} className="h-9 rounded-lg border border-border px-3 text-sm hover:bg-accent/70">
                Batal
              </button>
              <button type="button" onClick={() => void putuskan(true)} className="h-9 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                Ya, kirim
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
