"use client";

import { Cpu, Gpu, HardDrive, Loader2, MemoryStick, Pause, RefreshCw, Server, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { PageIntro } from "@/components/portal/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiPath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
import { cn } from "@/lib/utils";
import type { ButirDisk, ButirMemori, Keping, KepingCpu, KepingGpu, SumberDaya, Warna } from "@/server/modules/sumber-daya/layanan";

/**
 * Admin > Sumber daya server (butir 3, 6 Oktober 2026).
 *
 * Rincian di balik indikator widget ekstensi: RAM, CPU, disk, dan GPU untuk
 * ALETA saja dan untuk seluruh server, lalu pemakaian tiap aplikasi -
 * ALETA (container dan Docker) DIPISAH dari aplikasi lain (Apache + PHP,
 * MariaDB, layanan host). Berdetak tiap 5 detik selama tab terlihat; berhenti
 * saat tab disembunyikan. Hanya membaca.
 */

const DETAK_MS = 5000;

const WARNA_BILAH: Record<Warna, string> = {
  hijau: "bg-emerald-500",
  kuning: "bg-amber-500",
  merah: "bg-rose-500",
  kelabu: "bg-slate-300 dark:bg-slate-600",
};
const WARNA_TEKS: Record<Warna, string> = {
  hijau: "text-emerald-700 dark:text-emerald-400",
  kuning: "text-amber-700 dark:text-amber-400",
  merah: "text-rose-700 dark:text-rose-400",
  kelabu: "text-muted-foreground",
};

export function formatByte(n: number | null | undefined) {
  if (n === null || n === undefined || !Number.isFinite(n)) return "-";
  const satuan = ["B", "KB", "MB", "GB", "TB"];
  let v = Math.max(0, n);
  let i = 0;
  while (v >= 1024 && i < satuan.length - 1) {
    v /= 1024;
    i += 1;
  }
  const digit = v >= 100 || i === 0 ? 0 : 1;
  return `${v.toLocaleString("id-ID", { maximumFractionDigits: digit, minimumFractionDigits: digit })} ${satuan[i]}`;
}

function formatPersen(p: number | null | undefined) {
  return p === null || p === undefined ? "-" : `${p.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
}

function waktu(iso: string | null | undefined) {
  if (!iso) return "-";
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? "-" : t.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "medium" });
}

function Bilah({ persen, warna }: { persen: number | null; warna: Warna }) {
  const lebar = persen === null ? 0 : Math.max(1.5, Math.min(100, persen));
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted" role="presentation">
      <div className={cn("h-full rounded-full transition-all", WARNA_BILAH[warna])} style={{ width: `${lebar}%` }} />
    </div>
  );
}

/* === 12OKT-J: CPU === */
/** Jawaban bot lama tanpa CPU: tampil "tidak terbaca", tidak pernah 0%. */
const CPU_KOSONG: KepingCpu = { persen: null, warna: "kelabu", inti: null, intiTerpakai: null, beban: null, jendelaDetik: null };

/** 0,96 -> "0,96"; 8 -> "8". Inti yang dipakai boleh pecahan. */
export function formatInti(n: number | null | undefined) {
  if (n === null || n === undefined || !Number.isFinite(n)) return "-";
  return n.toLocaleString("id-ID", { maximumFractionDigits: 2, minimumFractionDigits: Number.isInteger(n) ? 0 : 1 });
}

/**
 * Keterangan di bawah meter CPU: "0,96 inti terpakai dari 8 inti" + beban
 * rata-rata 1/5/15 menit (hanya seluruh server) + peringatan SEBAGIAN.
 * Persen CPU = laju antara dua cuplikan, bukan angka sesaat.
 */
export function keteranganCpu(k: KepingCpu, adalahAleta: boolean) {
  if (k.persen === null) return "CPU tidak terbaca (bot belum mendapat dua cuplikan /proc/stat, atau tidak dapat membacanya).";
  const bagian = [`${formatInti(k.intiTerpakai)} inti terpakai dari ${formatInti(k.inti)} inti`];
  if (k.beban) {
    const f = (x: number) => x.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    bagian.push(`beban rata-rata ${f(k.beban.m1)} / ${f(k.beban.m5)} / ${f(k.beban.m15)} (1 / 5 / 15 menit)`);
  }
  if (k.jendelaDetik) bagian.push(`selisih ${k.jendelaDetik} detik terakhir`);
  const dasar = bagian.join(" · ");
  return adalahAleta && k.sebagian ? `${dasar} - SEBAGIAN: hanya container yang terukur tanpa netdata` : dasar;
}
/* === AKHIR 12OKT-J === */

function Meter({ ikon, label, keping, bawah }: { ikon: ReactNode; label: string; keping: Keping | KepingGpu | KepingCpu; bawah: string }) {
  return (
    <div className="space-y-1.5" data-meter={label}>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-2 font-medium text-foreground">
          {ikon}
          {label}
        </span>
        <span className={cn("font-semibold tabular-nums", WARNA_TEKS[keping.warna])} data-warna={keping.warna}>
          {"ada" in keping && !keping.ada ? "tidak ada" : "inti" in keping && keping.persen === null ? "tidak terbaca" : formatPersen(keping.persen)}
        </span>
      </div>
      <Bilah persen={keping.persen} warna={keping.warna} />
      <p className="text-xs leading-5 text-muted-foreground">{bawah}</p>
    </div>
  );
}

function KartuLingkup({ judul, ket, r, adalahAleta }: { judul: string; ket: string; r: SumberDaya["ringkas"]["aleta"]; adalahAleta: boolean }) {
  return (
    <Card className="border-border/80">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {adalahAleta ? <Sparkles className="h-4 w-4 text-primary" /> : <Server className="h-4 w-4 text-sky-600" />}
          {judul}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{ket}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Meter
          ikon={<MemoryStick className="h-4 w-4 text-muted-foreground" />}
          label="RAM"
          keping={r.ram}
          bawah={`${formatByte(r.ram.byte)} dari ${formatByte(r.ram.totalByte)}${"sebagian" in r.ram && r.ram.sebagian ? " - SEBAGIAN: hanya container portal yang terukur" : ""}`}
        />
        {/* === 12OKT-J: CPU === */}
        <Meter
          ikon={<Cpu className="h-4 w-4 text-muted-foreground" />}
          label="CPU"
          keping={r.cpu ?? CPU_KOSONG}
          bawah={keteranganCpu(r.cpu ?? CPU_KOSONG, adalahAleta)}
        />
        {/* === AKHIR 12OKT-J === */}
        <Meter
          ikon={<HardDrive className="h-4 w-4 text-muted-foreground" />}
          label="Disk"
          keping={r.disk}
          bawah={
            adalahAleta
              ? `${formatByte(r.disk.byte)} dari ${formatByte(r.disk.totalByte)} kapasitas seluruh partisi${r.disk.sebagian ? " - SEBAGIAN: citra & build cache Docker belum terukur" : ""}`
              : `${formatByte(r.disk.byte)} dari ${formatByte(r.disk.totalByte)} - partisi terpenuh ${r.disk.partisi ?? "-"}`
          }
        />
        <Meter ikon={<Gpu className="h-4 w-4 text-muted-foreground" />} label="GPU" keping={r.gpu} bawah={r.gpu.keterangan} />
      </CardContent>
    </Card>
  );
}

function TabelMemori({ butir, totalByte, kosong, inti }: { butir: ButirMemori[]; totalByte: number | null; kosong: string; inti?: number | null }) {
  if (!butir.length) return <p className="text-sm text-muted-foreground">{kosong}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
            <th className="py-2 pr-3 font-semibold">Aplikasi</th>
            <th className="py-2 pr-3 text-right font-semibold">RAM (proses)</th>
            <th className="py-2 pr-3 text-right font-semibold">% server</th>
            <th className="py-2 pr-3 text-right font-semibold" title="Laju CPU, persen dari seluruh kapasitas server (100% = semua inti)">
              CPU %
            </th>
            <th className="py-2 pr-3 text-right font-semibold">Cache berkas</th>
            <th className="py-2 text-right font-semibold">Swap</th>
          </tr>
        </thead>
        <tbody>
          {butir.map((b) => (
            <tr key={`${b.jenis}-${b.kunci}`} className="border-b border-border/60 last:border-0" data-butir={b.kunci}>
              <td className="py-2 pr-3">
                <span className="font-medium text-foreground">{b.nama}</span>
                <span className="ml-2 text-xs text-muted-foreground">{b.jenis === "container" ? `container ${b.kunci}` : `${b.kunci}.service`}</span>
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">{formatByte(b.ramByte)}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                {totalByte ? formatPersen(Math.round((b.ramByte / totalByte) * 1000) / 10) : "-"}
              </td>
              {/* === 12OKT-J: CPU per aplikasi === */}
              <td
                className="py-2 pr-3 text-right tabular-nums"
                data-cpu={b.cpuPersen === null || b.cpuPersen === undefined ? "tidak-terbaca" : String(b.cpuPersen)}
                title={
                  b.cpuInti === null || b.cpuInti === undefined
                    ? "CPU aplikasi ini tidak terbaca"
                    : `${formatInti(b.cpuInti)} inti${inti ? ` dari ${formatInti(inti)} inti` : ""}${b.cpuSumber === "sesaat" ? " (angka sesaat: rata-rata belum tersedia)" : ""}`
                }
              >
                {b.cpuPersen === null || b.cpuPersen === undefined ? (
                  <span className="text-muted-foreground">-</span>
                ) : (
                  <>
                    {formatPersen(b.cpuPersen)}
                    {b.cpuSumber === "sesaat" ? <span className="ml-0.5 text-xs text-muted-foreground">*</span> : null}
                  </>
                )}
              </td>
              {/* === AKHIR 12OKT-J === */}
              <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">{formatByte(b.cacheByte)}</td>
              <td className="py-2 text-right tabular-nums text-muted-foreground">{formatByte(b.swapByte)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TabelDiskAleta({ butir }: { butir: ButirDisk[] }) {
  if (!butir.length) return <p className="text-sm text-muted-foreground">Belum ada yang terukur.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
            <th className="py-2 pr-3 font-semibold">Bagian ALETA</th>
            <th className="py-2 pr-3 text-right font-semibold">Ukuran</th>
            <th className="py-2 text-right font-semibold">Keterangan</th>
          </tr>
        </thead>
        <tbody>
          {butir.map((b) => (
            <tr key={b.kunci} className="border-b border-border/60 last:border-0" data-disk={b.kunci}>
              <td className="py-2 pr-3 font-medium text-foreground">{b.nama}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{formatByte(b.byte)}</td>
              <td className="py-2 text-right text-xs text-muted-foreground">
                {[
                  b.dapatDiklaimByte ? `${formatByte(b.dapatDiklaimByte)} dapat dibersihkan` : "",
                  b.jumlah !== undefined && b.jumlah !== null ? `${b.jumlah} butir` : "",
                  b.berkas !== undefined ? `${b.berkas.toLocaleString("id-ID")} berkas` : "",
                  b.tabel ? `${b.tabel} tabel` : "",
                  b.terpotong ? "terpotong (terlalu banyak berkas)" : "",
                ]
                  .filter(Boolean)
                  .join(" · ") || "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SumberDayaPanel() {
  const [data, setData] = useState<SumberDaya | null>(null);
  const [galat, setGalat] = useState("");
  const [memuat, setMemuat] = useState(false);
  const [tersembunyi, setTersembunyi] = useState(false);
  const jalan = useRef(false);

  const muat = useCallback(async () => {
    if (jalan.current) return;
    jalan.current = true;
    setMemuat(true);
    try {
      const r = await fetch(apiPath("/api/admin/sumber-daya"), { cache: "no-store" });
      const isi = (await r.json().catch(() => null)) as { ok?: boolean; data?: SumberDaya; error?: unknown; message?: string } | null;
      if (!r.ok || !isi?.ok || !isi.data) {
        // Rute menjawab { ok:false, error:{ message } } - dulu String(error)
        // menampilkan "[object Object]" tepat saat ALETA Bot mati (U5, 9 Okt 2026).
        setGalat(pesanGalatPortal(isi, `Sumber daya server belum terbaca (HTTP ${r.status}).`));
      } else {
        setData(isi.data);
        setGalat("");
      }
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Portal tidak menjawab.");
    } finally {
      jalan.current = false;
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    let jam: ReturnType<typeof setInterval> | null = null;
    const mulai = () => {
      if (jam) return;
      void muat();
      jam = setInterval(() => void muat(), DETAK_MS);
    };
    const henti = () => {
      if (jam) clearInterval(jam);
      jam = null;
    };
    const atur = () => {
      const sembunyi = document.visibilityState === "hidden";
      setTersembunyi(sembunyi);
      if (sembunyi) henti();
      else mulai();
    };
    atur();
    document.addEventListener("visibilitychange", atur);
    return () => {
      document.removeEventListener("visibilitychange", atur);
      henti();
    };
  }, [muat]);

  const totalRam = data?.rincian.memori?.totalByte ?? data?.ringkas.server.ram.totalByte ?? null;
  const ramAleta = data ? data.rincian.aleta.reduce((s, b) => s + b.ramByte, 0) : 0;
  const ramLain = data ? data.rincian.lain.reduce((s, b) => s + b.ramByte, 0) : 0;
  const intiServer = data?.rincian.cpu?.inti ?? null; // 12OKT-J

  return (
    <div className="space-y-8">
      <PageIntro
        eyebrow="Pengaturan Admin"
        title="Sumber daya server"
        description="RAM, CPU, disk, dan GPU yang dipakai ALETA dibanding seluruh server, beserta pemakaian tiap aplikasi. Diperbarui tiap 5 detik selama halaman ini terbuka."
        actions={
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {tersembunyi ? (
              <span className="flex items-center gap-1">
                <Pause className="h-3.5 w-3.5" /> dijeda (tab tersembunyi)
              </span>
            ) : (
              <span data-testid="sumber-daya-diukur">Diukur {waktu(data?.diukurPada)}</span>
            )}
            <Button variant="outline" size="sm" onClick={() => void muat()} disabled={memuat}>
              {memuat ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
              Segarkan
            </Button>
          </div>
        }
      />

      {galat ? (
        <Card className="border-rose-300 bg-rose-50 dark:border-rose-500/40 dark:bg-rose-500/10">
          <CardContent className="pt-6 text-sm text-rose-800 dark:text-rose-300">{galat}</CardContent>
        </Card>
      ) : null}

      {!data ? (
        galat ? null : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Mengukur...
          </p>
        )
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            <KartuLingkup
              judul="ALETA"
              ket="Tiga container ALETA (portal, bot, PostgreSQL) beserta Docker yang menjalankannya."
              r={data.ringkas.aleta}
              adalahAleta
            />
            <KartuLingkup
              judul="Seluruh server"
              ket="Semua aplikasi di server: ALETA, SIPP, ABT, antrian, MariaDB, dan layanan host."
              r={data.ringkas.server}
              adalahAleta={false}
            />
          </div>

          <Card className="border-border/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">RAM dan CPU per aplikasi - ALETA</CardTitle>
              <p className="text-xs text-muted-foreground">
                Jumlah {formatByte(ramAleta)}. RAM = memori proses (RSS); cache berkas disebut terpisah karena dapat dilepas
                kernel kapan saja. CPU % = laju rata-rata beberapa detik terakhir, persen dari seluruh kapasitas server
                {intiServer ? ` (${formatInti(intiServer)} inti)` : ""}.
              </p>
            </CardHeader>
            <CardContent>
              <TabelMemori butir={data.rincian.aleta} totalByte={totalRam} inti={intiServer} kosong="Tidak ada container ALETA yang terbaca." />
            </CardContent>
          </Card>

          <Card className="border-border/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">RAM dan CPU per aplikasi - aplikasi lain</CardTitle>
              <p className="text-xs text-muted-foreground">
                Jumlah {formatByte(ramLain)}
                {data.rincian.ramLainnyaByte !== null
                  ? ` · kernel, sesi pengguna, dan proses di luar layanan: ${formatByte(data.rincian.ramLainnyaByte)}`
                  : ""}
                .
              </p>
            </CardHeader>
            <CardContent>
              <TabelMemori
                butir={data.rincian.lain}
                totalByte={totalRam}
                inti={intiServer}
                kosong="Rincian aplikasi lain belum terbaca (butuh netdata di host - lihat catatan di bawah)."
              />
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-border/80">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Partisi disk server</CardTitle>
                <p className="text-xs text-muted-foreground">Data Docker ALETA (citra, build cache) ada di /home; SIPP, ABT, MariaDB, dan data ALETA lain di /.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.rincian.partisi.map((p) => (
                  <div key={p.titik} className="space-y-1.5" data-partisi={p.titik}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">{p.titik}</span>
                      <span className={cn("font-semibold tabular-nums", WARNA_TEKS[p.warna])}>{formatPersen(p.persen)}</span>
                    </div>
                    <Bilah persen={p.persen} warna={p.warna} />
                    <p className="text-xs text-muted-foreground">
                      {formatByte(p.terpakaiByte)} terpakai dari {formatByte(p.totalByte)}
                      {p.sisaByte !== undefined ? ` · sisa ${formatByte(p.sisaByte)}` : ""}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="border-border/80">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Disk ALETA per bagian</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Jumlah {formatByte(data.rincian.diskAleta.byte)}
                  {data.rincian.docker ? ` · cuplikan Docker ${waktu(data.rincian.docker.dibuat)}` : " · citra Docker belum terukur"}
                  {data.rincian.folderDiukurPada ? ` · folder diukur ${waktu(data.rincian.folderDiukurPada)}` : ""}.
                  Sisa isi partisi milik aplikasi lain (SIPP, ABT, MariaDB, antrian).
                </p>
              </CardHeader>
              <CardContent>
                <TabelDiskAleta butir={data.rincian.diskAleta.rincian} />
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">GPU</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p data-testid="sumber-daya-gpu">{data.rincian.gpu.keterangan}</p>
              {data.rincian.gpu.perangkat.length ? (
                <ul className="list-disc pl-5 text-xs text-muted-foreground">
                  {data.rincian.gpu.perangkat.map((p, i) => (
                    <li key={i}>
                      {String(p.namaVendor ?? p.nama ?? "perangkat")} {p.device ? `(${String(p.vendor)}:${String(p.device)})` : ""}{" "}
                      {p.driver ? `driver ${String(p.driver)}` : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-muted/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Sumber angka</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs leading-5 text-muted-foreground">
              <ul className="space-y-1">
                {Object.entries(data.sumber).map(([k, v]) => (
                  <li key={k}>
                    <span className="font-semibold text-foreground">{k}</span>: {v}
                  </li>
                ))}
                <li>
                  <span className="font-semibold text-foreground">ambang warna</span>: RAM kuning {data.ambang.ram.kuning}% / merah{" "}
                  {data.ambang.ram.merah}% · CPU {data.ambang.cpu?.kuning ?? 70}% / {data.ambang.cpu?.merah ?? 90}% · disk {data.ambang.disk.kuning}% / {data.ambang.disk.merah}% · GPU {data.ambang.gpu.kuning}% /{" "}
                  {data.ambang.gpu.merah}%
                </li>
              </ul>
              {data.catatan.length ? (
                <ul className="list-disc space-y-1 pl-5 text-amber-800 dark:text-amber-300">
                  {data.catatan.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              ) : null}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
