"use client";

import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Info, Loader2, PlugZap, RefreshCw, Send, ShieldCheck, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { PageIntro } from "@/components/portal/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiPath } from "@/lib/base-path";
import type { BarisAntrean } from "@/server/modules/sinkron/kembaran";

/**
 * Layar "Sinkron kembaran" (laptop). Hanya Super Admin.
 *
 * Menampilkan tulisan ke SIPP/ABT yang ditahan selama server mati. Setiap
 * baris dibandingkan dengan nilai TERKINI di server: yang sudah berubah di
 * server ditandai BENTROK dan tidak dapat dikirim; tanggal sidang/putusan/
 * penetapan/minutasi yang sudah terisi DITAHAN. Hanya baris "Aman" yang dapat
 * disetujui, dan saat dikirim diperiksa ULANG. Tidak ada tombol paksa.
 */

type Gambaran = {
  aktif: boolean;
  pita: string;
  cap: { tarikPada: string; bundel?: string; bundelDibuat?: string } | null;
  hitung: Array<{ status: string; hasil: string | null; n: number }>;
  baris: BarisAntrean[];
  antreanGalat?: string | null;
  botGalat?: string | null;
};

const SEBUTAN_HASIL: Record<string, { teks: string; gaya: string }> = {
  aman: { teks: "Aman", gaya: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100" },
  bentrok: { teks: "Bentrok", gaya: "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100" },
  ditahan: { teks: "Ditahan", gaya: "border-orange-300 bg-orange-50 text-orange-900 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-100" },
  tak_dapat_diperiksa: { teks: "Tak dapat diperiksa", gaya: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100" },
};

const SEBUTAN_STATUS: Record<string, string> = {
  menunggu: "Menunggu",
  disetujui: "Disetujui",
  ditolak: "Disingkirkan",
  terkirim: "Terkirim",
  gagal: "Gagal dikirim",
};

const SEBUTAN_JENIS: Record<string, string> = {
  UPDATE: "Ubah",
  INSERT: "Tambah",
  DELETE: "Hapus",
  REPLACE: "Ganti",
  DDL: "Struktur",
  LAIN: "Lain",
  BERKAS_TULIS: "Berkas baru",
  BERKAS_PINDAH: "Pindah berkas",
};

const SEBUTAN_SUMBER: Record<string, string> = { sipp: "SIPP", abt: "ABT", antrian: "Antrian" };

function waktu(nilai: string | null | undefined) {
  if (!nilai) return "-";
  const t = new Date(nilai);
  if (!Number.isFinite(t.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Makassar" }).format(t);
}

async function panggil<T>(jalur: string, init?: RequestInit): Promise<T> {
  const jawab = await fetch(apiPath(jalur), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const isi = (await jawab.json().catch(() => null)) as { ok?: boolean; data?: T; error?: { message?: string } } | null;
  if (!jawab.ok || !isi?.ok) throw new Error(isi?.error?.message || `Server menjawab HTTP ${jawab.status}.`);
  return isi.data as T;
}

function Pesan({ jenis, children }: { jenis: "info" | "awas" | "bahaya" | "baik"; children: ReactNode }) {
  const gaya = {
    info: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-100",
    awas: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100",
    bahaya: "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100",
    baik: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100",
  }[jenis];
  const Ikon = jenis === "baik" ? CheckCircle2 : jenis === "info" ? Info : AlertTriangle;
  return (
    <div className={`flex gap-2 rounded-xl border px-3 py-2 text-sm leading-6 ${gaya}`}>
      <Ikon className="mt-1 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

function Lencana({ hasil, status }: { hasil: BarisAntrean["hasil"]; status: BarisAntrean["status"] }) {
  if (status === "terkirim" || status === "ditolak" || status === "gagal") {
    const gaya =
      status === "terkirim"
        ? "border-emerald-300 bg-emerald-50 text-emerald-900"
        : status === "gagal"
          ? "border-rose-300 bg-rose-50 text-rose-900"
          : "border-border bg-muted text-muted-foreground";
    return <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${gaya}`}>{SEBUTAN_STATUS[status]}</span>;
  }
  const h = hasil ? SEBUTAN_HASIL[hasil] : null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {status === "disetujui" ? <span className="rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-900">Disetujui</span> : null}
      {h ? (
        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${h.gaya}`}>{h.teks}</span>
      ) : (
        <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Belum diperiksa</span>
      )}
    </span>
  );
}

function ringkasNilai(v: unknown) {
  if (v === null || v === undefined) return "kosong";
  const t = String(v);
  return t.length > 70 ? `${t.slice(0, 67)}...` : t;
}

function Rincian({ b }: { b: BarisAntrean }) {
  if (b.berkas) {
    return (
      <p className="text-sm text-foreground">
        {b.jenis === "BERKAS_PINDAH" ? `Pindah ${b.berkas.dari ?? "?"} ke ${b.berkas.ke ?? "?"}` : `Berkas ${b.berkas.relatif ?? "?"}`}
        {b.berkas.ukuran ? ` (${Math.round(b.berkas.ukuran / 1024)} KB)` : ""}
      </p>
    );
  }
  if (b.nilai.length > 0) {
    return (
      <ul className="space-y-0.5 text-sm">
        {b.nilai.map((n) => (
          <li key={n.kolom}>
            <span className="font-medium">{n.kolom}</span>: <span className="text-muted-foreground">{n.lama.length ? ringkasNilai(n.lama[0]) : "?"}</span> {"->"}{" "}
            <span className="text-foreground">{ringkasNilai(n.baru)}</span>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <p className="break-all font-mono text-xs text-muted-foreground">
      {b.sql.slice(0, 220)}
      {b.sql.length > 220 || b.sqlTerpotong ? "..." : ""}
    </p>
  );
}

export function SinkronKembaranPanel() {
  const [data, setData] = useState<Gambaran | null>(null);
  const [error, setError] = useState("");
  const [pesan, setPesan] = useState<string[]>([]);
  const [sibuk, setSibuk] = useState("");
  const [dipilih, setDipilih] = useState<Set<number>>(new Set());
  const [tampil, setTampil] = useState<"antre" | "disetujui" | "selesai">("antre");
  const [terbuka, setTerbuka] = useState<Set<string>>(new Set());
  const [hasilUji, setHasilUji] = useState<Record<string, { ok: boolean; galat?: string }> | null>(null);

  const [versi, setVersi] = useState(0);
  const muat = useCallback(() => setVersi((v) => v + 1), []);

  useEffect(() => {
    let batal = false;
    panggil<Gambaran>("/api/admin/sinkron-kembaran")
      .then((g) => {
        if (batal) return;
        setData(g);
        setError("");
      })
      .catch((e: Error) => {
        if (!batal) setError(e.message);
      });
    return () => {
      batal = true;
    };
  }, [versi]);

  const aksi = async (nama: string, badan: Record<string, unknown> = {}) => {
    setSibuk(nama);
    setError("");
    try {
      return await panggil<Record<string, unknown>>("/api/admin/sinkron-kembaran/aksi", {
        method: "POST",
        body: JSON.stringify({ aksi: nama, ...badan }),
      });
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setSibuk("");
    }
  };

  const hitung = useMemo(() => {
    const h = { menunggu: 0, disetujui: 0, terkirim: 0, ditolak: 0, gagal: 0, aman: 0, bentrok: 0, ditahan: 0 };
    for (const b of data?.baris ?? []) {
      h[b.status] += 1;
      if (b.status === "menunggu" && b.hasil === "aman") h.aman += 1;
      if (b.status === "menunggu" && b.hasil === "bentrok") h.bentrok += 1;
      if (b.status === "menunggu" && b.hasil === "ditahan") h.ditahan += 1;
    }
    return h;
  }, [data]);

  const kelompok = useMemo(() => {
    const penyaring = (b: BarisAntrean) =>
      tampil === "antre" ? b.status === "menunggu" : tampil === "disetujui" ? b.status === "disetujui" : ["terkirim", "ditolak", "gagal"].includes(b.status);
    const peta = new Map<string, BarisAntrean[]>();
    for (const b of data?.baris ?? []) {
      if (!penyaring(b)) continue;
      if (!peta.has(b.kelompok)) peta.set(b.kelompok, []);
      peta.get(b.kelompok)!.push(b);
    }
    return [...peta.entries()]
      .map(([id, baris]) => ({ id, baris: baris.sort((x, y) => x.urutan - y.urutan || x.id - y.id) }))
      .sort((a, b) => b.baris[0].id - a.baris[0].id);
  }, [data, tampil]);

  const periksa = async (ids: number[] = []) => {
    const h = await aksi("periksa", { ids });
    if (h) {
      const r = (h.ringkas ?? {}) as Record<string, number>;
      setPesan([`Diperiksa terhadap server: ${h.diperiksa ?? 0} baris - aman ${r.aman ?? 0}, bentrok ${r.bentrok ?? 0}, ditahan ${r.ditahan ?? 0}, tak dapat diperiksa ${r.tak_dapat_diperiksa ?? 0}.`]);
      muat();
    }
  };

  const setujui = async (badan: { ids?: number[]; kelompok?: string }) => {
    const h = await aksi("setujui", badan);
    if (h) {
      const ditolak = (h.ditolak ?? []) as Array<{ id: number; alasan: string }>;
      if (ditolak.length) {
        setPesan([`${h.disetujui ?? 0} baris disetujui.`, ...ditolak.slice(0, 5).map((d) => `Baris #${d.id} tidak disetujui: ${d.alasan}`)]);
      } else setPesan([`${h.disetujui ?? 0} baris disetujui.`]);
      setDipilih(new Set());
      muat();
    }
  };

  const tolak = async (badan: { ids?: number[]; kelompok?: string }) => {
    const alasan = window.prompt("Alasan menyingkirkan (boleh kosong). Baris yang disingkirkan TIDAK akan dikirim ke server:", "");
    if (alasan === null) return;
    const h = await aksi("tolak", { ...badan, alasan });
    if (h) {
      setPesan([`${h.ditolak ?? 0} baris disingkirkan.`]);
      setDipilih(new Set());
      muat();
    }
  };

  const kirim = async () => {
    if (!window.confirm(`Kirim ${hitung.disetujui} baris yang disetujui ke server SIPP/ABT? Tiap baris diperiksa ulang terhadap server tepat sebelum dikirim.`)) return;
    const h = await aksi("kirim");
    if (h) {
      setPesan([`Terkirim: ${h.terkirim ?? 0} baris dalam ${h.kelompok ?? 0} kelompok; dibatalkan karena bentrok/gagal: ${h.dibatalkan ?? 0} kelompok.`]);
      muat();
    }
  };

  const uji = async () => {
    const h = await aksi("uji");
    if (h) setHasilUji((h.hasil ?? null) as Record<string, { ok: boolean; galat?: string }> | null);
  };

  const alihkan = (setter: (f: (s: Set<number>) => Set<number>) => void, id: number) =>
    setter((s) => {
      const baru = new Set(s);
      if (baru.has(id)) baru.delete(id);
      else baru.add(id);
      return baru;
    });

  if (!data) {
    return (
      <div className="space-y-6">
        <PageIntro eyebrow="Admin" title="Sinkron kembaran" description="Tulisan ke SIPP dan ABT yang ditahan selama server kantor mati." />
        {error ? <Pesan jenis="bahaya">{error}</Pesan> : <Loader2 className="h-5 w-5 animate-spin" />}
      </div>
    );
  }

  if (!data.aktif) {
    return (
      <div className="space-y-6">
        <PageIntro eyebrow="Admin" title="Sinkron kembaran" description="Tulisan ke SIPP dan ABT yang ditahan selama server kantor mati." />
        <Pesan jenis="info">
          Portal ini tidak berjalan di mode kembaran, jadi tidak ada antrean sinkron. Layar ini hanya hidup di laptop yang dinyalakan dengan ALETA_MODE=kembaran.
        </Pesan>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Admin"
        title="Sinkron kembaran"
        description="Tulisan ke SIPP dan ABT yang ditahan selama server kantor mati. Setiap baris dibandingkan dengan nilai terkini di server sebelum dikirim."
        actions={
          <>
            <Button variant="outline" onClick={() => muat()} disabled={Boolean(sibuk)}>
              <RefreshCw className="h-4 w-4" /> Muat ulang
            </Button>
            <Button variant="outline" onClick={() => void uji()} disabled={Boolean(sibuk)}>
              {sibuk === "uji" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />} Uji sambungan server
            </Button>
          </>
        }
      />

      <Pesan jenis="info">
        <strong>{data.pita}.</strong> Tidak ada tombol paksa: baris yang <strong>bentrok</strong> (server berubah sejak dicuplik) atau <strong>ditahan</strong> (tanggal
        sidang, putusan, penetapan, atau minutasi yang sudah terisi di server) tidak dapat dikirim - singkirkan atau perbaiki dengan tangan di server. Pelaku asli dan jam asli
        tiap tulisan dikirim apa adanya.
      </Pesan>
      {error ? <Pesan jenis="bahaya">{error}</Pesan> : null}
      {data.botGalat ? <Pesan jenis="awas">ALETA Bot: {data.botGalat}</Pesan> : null}
      {data.antreanGalat ? <Pesan jenis="bahaya">Antrean tidak dapat dibaca: {data.antreanGalat}</Pesan> : null}
      {pesan.length ? (
        <Pesan jenis="baik">
          {pesan.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </Pesan>
      ) : null}
      {hasilUji ? (
        <Pesan jenis={Object.values(hasilUji).every((x) => x.ok) ? "baik" : "awas"}>
          {Object.entries(hasilUji).map(([k, v]) => (
            <p key={k}>
              {k.toUpperCase()}: {v.ok ? "tersambung" : `GAGAL - ${v.galat ?? "tidak diketahui"}`}
            </p>
          ))}
        </Pesan>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Menunggu", hitung.menunggu],
          ["Aman", hitung.aman],
          ["Bentrok", hitung.bentrok],
          ["Ditahan", hitung.ditahan],
          ["Disetujui", hitung.disetujui],
        ].map(([label, n]) => (
          <Card key={String(label)}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-2xl font-semibold tabular-nums">{n}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5" /> Antrean
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["antre", `Menunggu (${hitung.menunggu})`],
                ["disetujui", `Disetujui (${hitung.disetujui})`],
                ["selesai", `Selesai (${hitung.terkirim + hitung.ditolak + hitung.gagal})`],
              ] as const
            ).map(([k, label]) => (
              <Button key={k} size="sm" variant={tampil === k ? "default" : "outline"} onClick={() => setTampil(k)}>
                {label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={Boolean(sibuk)} onClick={() => void periksa([])}>
              {sibuk === "periksa" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Periksa semua terhadap server
            </Button>
            <Button size="sm" variant="outline" disabled={Boolean(sibuk) || dipilih.size === 0} onClick={() => void setujui({ ids: [...dipilih] })}>
              <CheckCircle2 className="h-4 w-4" /> Setujui yang dipilih ({dipilih.size})
            </Button>
            <Button size="sm" variant="outline" disabled={Boolean(sibuk) || dipilih.size === 0} onClick={() => void tolak({ ids: [...dipilih] })}>
              <Trash2 className="h-4 w-4" /> Singkirkan yang dipilih
            </Button>
            <Button size="sm" disabled={Boolean(sibuk) || hitung.disetujui === 0} onClick={() => void kirim()}>
              {sibuk === "kirim" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Kirim yang disetujui ({hitung.disetujui})
            </Button>
          </div>

          {kelompok.length === 0 ? <p className="text-sm text-muted-foreground">Tidak ada baris pada tampilan ini.</p> : null}

          {kelompok.map((k) => {
            const kepala = k.baris[0];
            const buka = terbuka.has(k.id);
            const sumber = [...new Set(k.baris.map((b) => SEBUTAN_SUMBER[b.sumber] ?? b.sumber))].join(", ");
            const semuaAman = k.baris.every((b) => b.status === "menunggu" && b.hasil === "aman");
            return (
              <div key={k.id} className="rounded-xl border border-border/80">
                <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <button
                    type="button"
                    aria-label={buka ? "Tutup rincian" : "Buka rincian"}
                    className="rounded-md p-1 hover:bg-accent"
                    onClick={() =>
                      setTerbuka((s) => {
                        const baru = new Set(s);
                        if (baru.has(k.id)) baru.delete(k.id);
                        else baru.add(k.id);
                        return baru;
                      })
                    }
                  >
                    {buka ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {kepala.operasi || "Tulisan latar"} <span className="font-normal text-muted-foreground">- {k.baris.length} baris ke {sumber}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {waktu(kepala.dicatatPada)} oleh {kepala.aktor || "tidak tercatat"}
                    </p>
                  </div>
                  {tampil === "antre" ? (
                    <>
                      <Button size="sm" variant="outline" disabled={Boolean(sibuk)} onClick={() => void periksa(k.baris.map((b) => b.id))}>
                        Periksa
                      </Button>
                      <Button size="sm" variant="outline" disabled={Boolean(sibuk) || !semuaAman} title={semuaAman ? "" : "Semua baris kelompok harus aman"} onClick={() => void setujui({ kelompok: k.id })}>
                        Setujui kelompok
                      </Button>
                      <Button size="sm" variant="ghost" disabled={Boolean(sibuk)} onClick={() => void tolak({ kelompok: k.id })}>
                        Singkirkan
                      </Button>
                    </>
                  ) : null}
                </div>
                {buka ? (
                  <ul className="divide-y divide-border/70 border-t border-border/70">
                    {k.baris.map((b) => (
                      <li key={b.id} className="flex gap-3 px-3 py-2">
                        {tampil === "antre" ? (
                          <input type="checkbox" aria-label={`Pilih baris ${b.id}`} className="mt-1" checked={dipilih.has(b.id)} onChange={() => alihkan(setDipilih, b.id)} />
                        ) : null}
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="font-medium">
                              #{b.urutan} {SEBUTAN_JENIS[b.jenis] ?? b.jenis} {b.tabel}
                            </span>
                            <Lencana hasil={b.hasil} status={b.status} />
                            {b.terdampak !== null ? <span className="text-xs text-muted-foreground">{b.terdampak} baris</span> : null}
                          </div>
                          <Rincian b={b} />
                          {b.periksa?.alasan?.length ? (
                            <ul className="list-disc pl-5 text-xs text-rose-800 dark:text-rose-200">
                              {b.periksa.alasan.map((a) => (
                                <li key={a}>{a}</li>
                              ))}
                            </ul>
                          ) : null}
                          {b.periksa?.catatan?.length ? (
                            <ul className="list-disc pl-5 text-xs text-muted-foreground">
                              {b.periksa.catatan.map((a) => (
                                <li key={a}>{a}</li>
                              ))}
                            </ul>
                          ) : null}
                          {b.galat ? <p className="text-xs text-rose-700">Kesalahan: {b.galat}</p> : null}
                          {b.disetujuiOleh ? (
                            <p className="text-xs text-muted-foreground">
                              Disetujui {b.disetujuiOleh}, {waktu(b.disetujuiPada)}
                            </p>
                          ) : null}
                          {b.dikirimPada ? (
                            <p className="text-xs text-muted-foreground">
                              Dikirim {waktu(b.dikirimPada)} oleh {b.dikirimOleh}
                            </p>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
