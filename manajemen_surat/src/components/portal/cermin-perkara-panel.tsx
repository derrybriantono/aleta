"use client";

import { Database, Loader2, Pause, Play, RefreshCw, RotateCcw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { apiPath } from "@/lib/base-path";
import type { LayarCermin, PengaturanCermin } from "@/lib/cermin";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
import type { HalamanPemantauCermin } from "@/server/modules/cermin/pemantau";

/**
 * Admin > Pemantau Cermin Perkara (C0, 25 Okt 2026).
 *
 * Kemajuan pemindai awal ("18.400 dari 23.100 perkara, perkiraan selesai
 * 02.40"), saklar per layar (SEMUA MATI bawaan), dan hitungan tabel cermin.
 * Admin dan Super Admin melihat; hanya Super Admin yang mengubah. Cermin hanya
 * untuk dibaca - SIPP tetap sumber kebenaran, dan layar yang cerminnya
 * tertinggal membaca SIPP seperti sekarang.
 */

const DETAK_MS = 10_000;

const angka = (n: number) => n.toLocaleString("id-ID");

/** Jam WITA "02.40" dari waktu ISO. */
export function jamWita(iso: string | null | undefined) {
  if (!iso) return "-";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Makassar", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .format(t)
    .replace(":", ".");
}

function tanggalJamWita(iso: string | null | undefined) {
  if (!iso) return "-";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "-";
  return `${new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Makassar", day: "numeric", month: "short" }).format(t)}, ${jamWita(iso)}`;
}

/** Kalimat kemajuan, dipakai layar dan uji. */
export function kalimatKemajuan(h: Pick<HalamanPemantauCermin, "keadaan" | "perkiraanSelesai">) {
  const k = h.keadaan;
  if (k.status === "belum") return "Pemindaian awal belum dimulai.";
  if (k.status === "selesai") return `Pemindaian awal selesai (${angka(k.perkara.diproses)} perkara, ${angka(k.sidang.diproses)} sidang).`;
  const bagian =
    k.tahap === "perkara"
      ? `${angka(k.perkara.diproses)} dari ${angka(k.perkara.total)} perkara`
      : `${angka(k.perkara.diproses)} perkara selesai; sidang ${angka(k.sidang.diproses)} dari ${angka(k.sidang.total)}`;
  const perkiraan = h.perkiraanSelesai ? `, perkiraan selesai ${tanggalJamWita(h.perkiraanSelesai)}` : "";
  return `${bagian}${perkiraan}`;
}

const LABEL_STATUS: Record<string, { teks: string; varian: "success" | "warning" | "danger" | "muted" | "info" }> = {
  belum: { teks: "Belum dimulai", varian: "muted" },
  berjalan: { teks: "Berjalan", varian: "info" },
  jeda: { teks: "Jeda (di luar jam pemindaian)", varian: "warning" },
  selesai: { teks: "Selesai", varian: "success" },
  galat: { teks: "Berhenti karena galat", varian: "danger" },
};

export function CerminPerkaraPanel() {
  const [data, setData] = useState<HalamanPemantauCermin | null>(null);
  const [galat, setGalat] = useState("");
  const [pesan, setPesan] = useState("");
  const [memuat, setMemuat] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);
  const [draf, setDraf] = useState<PengaturanCermin | null>(null);
  const jalan = useRef(false);
  const drafKotor = useRef(false);

  const muat = useCallback(async () => {
    if (jalan.current) return;
    jalan.current = true;
    setMemuat(true);
    try {
      const r = await fetch(apiPath("/api/admin/cermin-perkara"), { cache: "no-store" });
      const isi = (await r.json().catch(() => null)) as { ok?: boolean; data?: HalamanPemantauCermin } | null;
      if (!r.ok || !isi?.ok || !isi.data) {
        setGalat(pesanGalatPortal(isi, `Pemantau Cermin Perkara belum terbaca (HTTP ${r.status}).`));
      } else {
        setData(isi.data);
        if (!drafKotor.current) setDraf(isi.data.pengaturan);
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
    const atur = () => (document.visibilityState === "hidden" ? henti() : mulai());
    atur();
    document.addEventListener("visibilitychange", atur);
    return () => {
      document.removeEventListener("visibilitychange", atur);
      henti();
    };
  }, [muat]);

  const ubah = (f: (p: PengaturanCermin) => PengaturanCermin) => {
    drafKotor.current = true;
    setDraf((p) => (p ? f(p) : p));
  };

  const kirim = async (metode: "PUT" | "POST", badan: Record<string, unknown>, sukses: string) => {
    setMenyimpan(true);
    setPesan("");
    try {
      const r = await fetch(apiPath("/api/admin/cermin-perkara"), {
        method: metode,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(badan),
      });
      const isi = (await r.json().catch(() => null)) as { ok?: boolean; data?: unknown } | null;
      if (!r.ok || !isi?.ok) {
        setGalat(pesanGalatPortal(isi, `Permintaan ditolak (HTTP ${r.status}).`));
      } else {
        setGalat("");
        setPesan(sukses);
        drafKotor.current = false;
        await muat();
      }
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Portal tidak menjawab.");
    } finally {
      setMenyimpan(false);
    }
  };

  const bolehMengubah = data?.bolehMengubah === true;
  const status = data ? LABEL_STATUS[data.keadaan.status] ?? LABEL_STATUS.belum : null;

  return (
    <div className="space-y-8" data-testid="cermin-perkara-panel">
      <PageIntro
        eyebrow="Pengaturan Admin"
        title="Pemantau Cermin Perkara"
        description="Keadaan tiap perkara SIPP disalin ke basis data ALETA supaya layar tidak menanyai SIPP berkali-kali. Cermin hanya untuk dibaca; SIPP tetap sumber kebenaran, dan layar yang cerminnya tertinggal membaca SIPP seperti biasa."
        actions={
          <Button variant="outline" size="sm" onClick={() => void muat()} disabled={memuat}>
            {memuat ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
            Segarkan
          </Button>
        }
      />

      {galat ? (
        <p className="rounded-lg border border-rose-300/70 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-700/50 dark:bg-rose-950/50 dark:text-rose-300" role="alert">
          {galat}
        </p>
      ) : null}
      {pesan ? (
        <p className="rounded-lg border border-emerald-300/70 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-700/50 dark:bg-emerald-950/50 dark:text-emerald-300" role="status">
          {pesan}
        </p>
      ) : null}

      {data && draf && status ? (
        <>
          <Card className="border-border/80">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-4 w-4" /> Pemindaian awal
                <Badge variant={status.varian} data-testid="cermin-status">
                  {status.teks}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={data.persen} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(data.persen, data.persen > 0 ? 1.5 : 0)}%` }} />
              </div>
              <p className="text-sm text-foreground" data-testid="cermin-kemajuan">
                {data.persen}% - {kalimatKemajuan(data)}
              </p>
              <p className="text-xs leading-5 text-muted-foreground">
                Jam pemindaian {data.jendela.mulai.replace(":", ".")}-{data.jendela.selesai.replace(":", ".")} WITA
                {data.jendela.dalamJendelaSekarang ? " (sekarang di dalam jendela)" : " (sekarang di luar jendela)"}. Titik terakhir disimpan, jadi bila
                terputus pemindaian lanjut dari situ. Putaran terakhir {tanggalJamWita(data.keadaan.putaranTerakhir)}.
              </p>
              {data.keadaan.galat.terakhir ? (
                <p className="text-xs leading-5 text-rose-700 dark:text-rose-300" data-testid="cermin-galat">
                  Galat terakhir ({data.keadaan.galat.beruntun}x beruntun, {tanggalJamWita(data.keadaan.galat.pada)}): {data.keadaan.galat.terakhir}
                </p>
              ) : null}
              {data.keadaan.peringatan.length ? (
                <ul className="list-disc space-y-1 pl-5 text-xs text-amber-800 dark:text-amber-300">
                  {data.keadaan.peringatan.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              ) : null}
              {bolehMengubah ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" variant="outline" disabled={menyimpan} onClick={() => void kirim("POST", { aksi: "putaran-sekarang" }, "Satu kelompok dijalankan.")}>
                    <Play className="mr-1.5 h-4 w-4" /> Jalankan satu kelompok sekarang
                  </Button>
                  {data.keadaan.status === "galat" ? (
                    <Button size="sm" variant="outline" disabled={menyimpan} onClick={() => void kirim("POST", { aksi: "lanjutkan" }, "Pemindai dilanjutkan.")}>
                      <Pause className="mr-1.5 h-4 w-4" /> Lanjutkan
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={menyimpan}
                    onClick={() => {
                      if (window.confirm("Mulai ulang pemindaian awal dari perkara pertama? Isi cermin tetap; baris yang sama tidak ditulis ulang.")) {
                        void kirim("POST", { aksi: "ulang", konfirmasi: true }, "Pemindaian dimulai ulang.");
                      }
                    }}
                  >
                    <RotateCcw className="mr-1.5 h-4 w-4" /> Mulai ulang
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-border/80" data-testid="cermin-pembaruan">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <RefreshCw className="h-4 w-4" /> Pembaruan berkala
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Sesudah pemindaian awal selesai, cermin dijaga terbaru: tiap {draf.selangPembaruanDetik} detik hanya perkara yang berubah di SIPP yang dibaca ulang, sidang{" "}
                {draf.panasHariLalu} hari lalu sampai {draf.panasHariDepan} hari ke depan dihitung ulang tiap {draf.panasMenit} menit, dan tulisan lewat ALETA masuk seketika.
              </p>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {data.keadaan.status !== "selesai" ? (
                <p className="text-muted-foreground">Menunggu pemindaian awal selesai.</p>
              ) : (
                <>
                  <p data-testid="cermin-pembaruan-terakhir">
                    Putaran terakhir {tanggalJamWita(data.pembaruan.putaranTerakhir)}
                    {data.pembaruan.terakhir
                      ? ` - ${angka(data.pembaruan.terakhir.perkara)} perkara tersentuh, ${angka(data.pembaruan.terakhir.tanggal)} tanggal sidang dihitung ulang, ${angka(data.pembaruan.terakhir.ditulis)} baris ditulis (${angka(data.pembaruan.terakhir.ms)} md)`
                      : ""}
                    .
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Tanda waktu SIPP {data.pembaruan.tanda || "-"} · antrean tanggal {angka(data.pembaruan.antrianTanggal.length)}.
                  </p>
                  {data.pembaruan.galat.terakhir ? (
                    <p className="text-xs leading-5 text-rose-700 dark:text-rose-300" data-testid="cermin-pembaruan-galat">
                      Galat terakhir ({data.pembaruan.galat.beruntun}x beruntun, {tanggalJamWita(data.pembaruan.galat.pada)}): {data.pembaruan.galat.terakhir}
                    </p>
                  ) : null}
                  {data.pembaruan.tidakTerbaca.length ? (
                    <p className="text-xs leading-5 text-amber-800 dark:text-amber-300">Tabel SIPP yang tidak terbaca: {data.pembaruan.tidakTerbaca.join("; ")}.</p>
                  ) : null}
                </>
              )}
              {bolehMengubah ? (
                <Button size="sm" variant="outline" disabled={menyimpan} onClick={() => void kirim("POST", { aksi: "pembaruan-sekarang" }, "Satu putaran pembaruan dijalankan.")}>
                  <Play className="mr-1.5 h-4 w-4" /> Perbarui sekarang
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-border/80" data-testid="cermin-pencocokan">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4" /> Pencocokan mingguan
                {data.pencocokan.terakhir ? (
                  <Badge variant={data.pencocokan.bersih ? "success" : "warning"} data-testid="cermin-pencocokan-status">
                    {data.pencocokan.bersih ? "Bersih" : "Ada selisih (sudah diperbaiki)"}
                  </Badge>
                ) : (
                  <Badge variant="muted">Belum pernah</Badge>
                )}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Tiap Minggu 02.00 WITA: daftar ringan SIPP dibandingkan dengan cermin untuk menangkap data yang dihapus di SIPP dan baris yang tidak punya kolom waktu.
                Syarat menyalakan layar: pemindaian 100% dan pencocokan pertama bersih.
              </p>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {data.pencocokan.terakhir ? (
                <p data-testid="cermin-pencocokan-hasil">
                  {tanggalJamWita(data.pencocokan.terakhir.pada)} ({data.pencocokan.terakhir.pemicu === "tombol" ? "tombol" : "terjadwal"}, {angka(data.pencocokan.terakhir.ms)} md) - perkara:{" "}
                  {angka(data.pencocokan.terakhir.perkaraDihapus)} dihapus, {angka(data.pencocokan.terakhir.perkaraDitambah)} ditambah, {angka(data.pencocokan.terakhir.perkaraDiperbaiki)} diperbaiki; sidang:{" "}
                  {angka(data.pencocokan.terakhir.sidangDihapus)} dihapus, {angka(data.pencocokan.terakhir.sidangDitambah)} ditambah, {angka(data.pencocokan.terakhir.sidangDiperbaiki)} diperbaiki.
                  {data.pencocokan.terakhir.catatan ? ` ${data.pencocokan.terakhir.catatan}` : ""}
                </p>
              ) : (
                <p className="text-muted-foreground">Pencocokan pertama berjalan Minggu 02.00 WITA berikutnya, atau jalankan sekarang sesudah pemindaian selesai.</p>
              )}
              {bolehMengubah ? (
                <Button size="sm" variant="outline" disabled={menyimpan || data.keadaan.status !== "selesai"} onClick={() => void kirim("POST", { aksi: "pencocokan-sekarang" }, "Pencocokan dijalankan.")}>
                  <Play className="mr-1.5 h-4 w-4" /> Cocokkan sekarang
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-border/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Isi cermin</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 text-sm sm:grid-cols-5" data-testid="cermin-hitungan">
                {(
                  [
                    ["Perkara", data.hitungan.perkara],
                    ["Sidang", data.hitungan.sidang],
                    ["Pihak", data.hitungan.pihak],
                    ["Mediasi", data.hitungan.mediasi],
                    ["Penanda", data.hitungan.tag],
                  ] as const
                ).map(([label, n]) => (
                  <div key={label}>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="text-lg font-semibold tabular-nums">{angka(n)}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-xs text-muted-foreground">
                Perkara diperbarui {tanggalJamWita(data.hitungan.perkaraTerbaru)} · sidang diperbarui {tanggalJamWita(data.hitungan.sidangTerbaru)}.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Saklar</CardTitle>
              <p className="text-xs text-muted-foreground">
                Semua mati bawaan. Nyalakan pemindai lebih dulu; sesudah pemindaian 100% dan pencocokan bersih, nyalakan layar satu per satu: Jadwal Mediasi,
                Status Perkara, Jadwal Sidang, lalu panel ekstensi. Layar yang saklarnya mati membaca SIPP seperti sebelum ada cermin.
                {bolehMengubah ? "" : " Hanya Super Admin yang dapat mengubah saklar."}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Pemindai cermin</p>
                  <p className="text-xs text-muted-foreground">Membaca SIPP berkelompok pada jam pemindaian, lalu menjaga cermin tetap terbaru.</p>
                </div>
                <Switch
                  aria-label="Pemindai cermin"
                  checked={draf.pemindaiAktif}
                  disabled={!bolehMengubah}
                  onCheckedChange={(v) => ubah((p) => ({ ...p, pemindaiAktif: v }))}
                />
              </div>
              {data.layar.map((l) => (
                <div key={l.kunci} className="flex items-center justify-between gap-3" data-layar={l.kunci}>
                  <div>
                    <p className="text-sm font-medium">{l.label}</p>
                    <p className="text-xs text-muted-foreground">Membaca cermin (kembali ke SIPP bila cermin tertinggal).</p>
                  </div>
                  <Switch
                    aria-label={l.label}
                    checked={draf.layar[l.kunci as LayarCermin]}
                    disabled={!bolehMengubah}
                    onCheckedChange={(v) => ubah((p) => ({ ...p, layar: { ...p.layar, [l.kunci]: v } }))}
                  />
                </div>
              ))}
              <div className="grid gap-3 sm:grid-cols-4">
                <label className="space-y-1 text-xs text-muted-foreground">
                  Perkara per kelompok
                  <input
                    type="number"
                    className="block w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                    value={draf.ukuranKelompok}
                    min={50}
                    max={500}
                    disabled={!bolehMengubah}
                    onChange={(e) => ubah((p) => ({ ...p, ukuranKelompok: Number(e.target.value) }))}
                  />
                </label>
                <label className="space-y-1 text-xs text-muted-foreground">
                  Jeda antar kelompok (detik)
                  <input
                    type="number"
                    className="block w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                    value={draf.jedaDetik}
                    min={2}
                    max={600}
                    disabled={!bolehMengubah}
                    onChange={(e) => ubah((p) => ({ ...p, jedaDetik: Number(e.target.value) }))}
                  />
                </label>
                <label className="space-y-1 text-xs text-muted-foreground">
                  Mulai (WITA)
                  <input
                    type="time"
                    className="block w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                    value={draf.jendelaMulai}
                    disabled={!bolehMengubah}
                    onChange={(e) => ubah((p) => ({ ...p, jendelaMulai: e.target.value }))}
                  />
                </label>
                <label className="space-y-1 text-xs text-muted-foreground">
                  Berhenti (WITA)
                  <input
                    type="time"
                    className="block w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                    value={draf.jendelaSelesai}
                    disabled={!bolehMengubah}
                    onChange={(e) => ubah((p) => ({ ...p, jendelaSelesai: e.target.value }))}
                  />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <label className="space-y-1 text-xs text-muted-foreground">
                  Selang pembaruan (detik)
                  <input
                    type="number"
                    className="block w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                    value={draf.selangPembaruanDetik}
                    min={30}
                    max={3600}
                    disabled={!bolehMengubah}
                    onChange={(e) => ubah((p) => ({ ...p, selangPembaruanDetik: Number(e.target.value) }))}
                  />
                </label>
                <label className="space-y-1 text-xs text-muted-foreground">
                  Hitung ulang sidang panas (menit)
                  <input
                    type="number"
                    className="block w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                    value={draf.panasMenit}
                    min={1}
                    max={60}
                    disabled={!bolehMengubah}
                    onChange={(e) => ubah((p) => ({ ...p, panasMenit: Number(e.target.value) }))}
                  />
                </label>
                <label className="space-y-1 text-xs text-muted-foreground">
                  Panas: hari ke belakang
                  <input
                    type="number"
                    className="block w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                    value={draf.panasHariLalu}
                    min={0}
                    max={7}
                    disabled={!bolehMengubah}
                    onChange={(e) => ubah((p) => ({ ...p, panasHariLalu: Number(e.target.value) }))}
                  />
                </label>
                <label className="space-y-1 text-xs text-muted-foreground">
                  Panas: hari ke depan
                  <input
                    type="number"
                    className="block w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                    value={draf.panasHariDepan}
                    min={0}
                    max={30}
                    disabled={!bolehMengubah}
                    onChange={(e) => ubah((p) => ({ ...p, panasHariDepan: Number(e.target.value) }))}
                  />
                </label>
              </div>
              {bolehMengubah ? (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" disabled={menyimpan} onClick={() => void kirim("PUT", { ...draf }, "Pengaturan disimpan.")}>
                    Simpan pengaturan
                  </Button>
                  <Button size="sm" variant="outline" disabled={menyimpan} onClick={() => void kirim("PUT", { bawaan: true }, "Kembali ke bawaan: semua mati.")}>
                    Matikan semua (bawaan)
                  </Button>
                </div>
              ) : null}
              {data.pengaturan.diubahOleh ? (
                <p className="text-xs text-muted-foreground">
                  Terakhir diubah oleh {data.pengaturan.diubahOleh}, {tanggalJamWita(data.pengaturan.diubahPada)}.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </>
      ) : memuat ? (
        <p className="text-sm text-muted-foreground">Memuat...</p>
      ) : null}
    </div>
  );
}
