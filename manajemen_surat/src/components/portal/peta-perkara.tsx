"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, Info, MapPin, Undo2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { apiPath } from "@/lib/base-path";
import { cn } from "@/lib/utils";

import { JENIS_GRAFIK, type JenisGrafik } from "@/components/portal/statistics-chart";

const LazyStatisticsChart = dynamic(
  () => import("@/components/portal/statistics-chart").then((m) => m.StatisticsChart),
  {
    ssr: false,
    loading: () => <div className="min-h-[300px] rounded-[1.4rem] border border-border bg-muted/30" />,
  }
);

type Tempat = {
  nama: string;
  kode: string;
  perkara: number;
  lelaki: number;
  perempuan: number;
  jenis: Record<string, number>;
};

type HasilPeta = {
  ok: boolean;
  alasan?: string;
  kelompok: string;
  kelompokNama: string;
  perceraian: boolean;
  penanda: Record<string, string>;
  jenisMuncul: Record<string, number>;
  tingkat: string;
  induk: string;
  rentang: { dari: string; sampai: string };
  petaGeografis: boolean;
  alasanTanpaPeta: string;
  ringkas: {
    diputus: number;
    beralamat: number;
    larutNama: number;
    persenBeralamat: number;
    terpetakan: number;
    lelaki: number;
    perempuan: number;
    persenPerempuan: number;
  };
  wilayah: Tempat[];
  faktor: Tempat[];
};

type MenuJenis = { kunci: string; nama: string; perkara: number; gabungan: boolean };

const TINGKAT: { nilai: string; label: string; anak: string }[] = [
  { nilai: "provinsi", label: "Provinsi", anak: "kabupaten" },
  { nilai: "kabupaten", label: "Kabupaten / Kota", anak: "kecamatan" },
  { nilai: "kecamatan", label: "Kecamatan", anak: "kelurahan" },
  { nilai: "kelurahan", label: "Desa / Kelurahan", anak: "" },
];

const PERIODE = [
  { nilai: "bulan", label: "Bulan" },
  { nilai: "triwulan", label: "Triwulan" },
  { nilai: "semester", label: "Semester" },
  { nilai: "tahun", label: "Tahun" },
  { nilai: "total", label: "Seluruhnya" },
];

/**
 * Warna penanda jenis perkara.
 *
 * Satker meminta cerai gugat merah dan cerai talak biru. Keduanya warna
 * SEMANTIK di sini - penanda identitas, bukan slot palet kategori - jadi ia
 * tidak diambil dari palet grafik dan tidak ikut berputar ketika jumlah
 * kategorinya berubah.
 */
const WARNA_PENANDA: Record<string, string> = {
  merah: "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300",
  biru: "border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-300",
};

const angka = (n: number) => n.toLocaleString("id-ID");

function hariIni() {
  const d = new Date();
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Membuka bungkus { ok, data } - membacanya langsung selalu keliru dan tidak berbunyi. */
async function bukaBungkus<T>(balasan: Response): Promise<T> {
  return ((await balasan.json()) as { data?: T })?.data ?? ({} as T);
}

export function PetaPerkara() {
  const [menu, setMenu] = useState<MenuJenis[]>([]);
  const [kelompok, setKelompok] = useState("perceraian");
  const [tingkat, setTingkat] = useState("kabupaten");
  const [periode, setPeriode] = useState("tahun");
  const [acuan, setAcuan] = useState(hariIni());
  const [bentuk, setBentuk] = useState<JenisGrafik>("bar-h");
  const [lihat, setLihat] = useState<"wilayah" | "faktor">("wilayah");

  /**
   * Jejak penelusuran - tiap langkah menyimpan tingkat, kode, dan namanya.
   *
   * Disimpan sebagai tumpukan supaya "kembali" mengembalikan tepat satu
   * langkah. Menyimpan hanya kode yang terakhir membuat tombol kembali harus
   * menebak dari mana ia datang.
   */
  const [jejak, setJejak] = useState<{ tingkat: string; kode: string; nama: string }[]>([]);

  const [hasil, setHasil] = useState<HasilPeta | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const induk = jejak.length > 0 ? jejak[jejak.length - 1].kode : "";

  useEffect(() => {
    void (async () => {
      try {
        const balasan = await fetch(apiPath("/api/aleta-ecourt/peta-perkara?menu=1"), { cache: "no-store" });
        const isi = await bukaBungkus<{ ok: boolean; menu?: MenuJenis[] }>(balasan);
        if (isi.ok && Array.isArray(isi.menu)) setMenu(isi.menu);
      } catch {
        // Menu yang gagal dimuat menyisakan pilihan bawaan "perceraian" -
        // layarnya tetap berguna, hanya tidak dapat berpindah jenis perkara.
      }
    })();
  }, []);

  const ambil = useCallback(async () => {
    setMemuat(true);
    setGalat(null);
    try {
      const kueri = new URLSearchParams({ kelompok, tingkat, periode, acuan });
      if (induk) kueri.set("induk", induk);
      const balasan = await fetch(apiPath(`/api/aleta-ecourt/peta-perkara?${kueri.toString()}`), {
        cache: "no-store",
      });
      const isi = await bukaBungkus<HasilPeta>(balasan);
      if (!isi.ok) {
        setHasil(null);
        setGalat(isi.alasan || "Sebaran perkara tidak dapat disusun.");
      } else {
        setHasil(isi);
      }
    } catch (e) {
      setHasil(null);
      setGalat(e instanceof Error ? e.message : "Sebaran perkara tidak dapat disusun.");
    } finally {
      setMemuat(false);
    }
  }, [kelompok, tingkat, periode, acuan, induk]);

  useEffect(() => {
    void ambil();
  }, [ambil]);

  const daftar = hasil ? (lihat === "faktor" ? hasil.faktor : hasil.wilayah) : [];

  const dataGrafik = useMemo(
    () => daftar.slice(0, 20).map((t) => ({ label: t.nama, value: t.perkara })),
    [daftar]
  );

  const tingkatIni = TINGKAT.find((t) => t.nilai === tingkat);
  const bisaTurun = Boolean(tingkatIni?.anak) && lihat === "wilayah";

  const turun = useCallback(
    (t: Tempat) => {
      if (!bisaTurun || !t.kode) return;
      setJejak((j) => [...j, { tingkat, kode: t.kode, nama: t.nama }]);
      setTingkat(tingkatIni?.anak ?? tingkat);
    },
    [bisaTurun, tingkat, tingkatIni]
  );

  const kembali = useCallback(() => {
    setJejak((j) => {
      const baru = j.slice(0, -1);
      const terakhir = j[j.length - 1];
      if (terakhir) setTingkat(terakhir.tingkat);
      return baru;
    });
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4" aria-hidden />
            Peta perkara
          </CardTitle>
          <CardDescription>
            Dari mana perkara datang, faktor apa yang paling sering disebut, dan siapa yang lebih sering
            mengajukan — laki-laki atau perempuan. Ditelusuri dari provinsi sampai desa.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[13rem] flex-1 flex-col gap-1 text-xs text-muted-foreground">
              Jenis perkara
              <NativeSelect
                value={kelompok}
                onChange={(e) => {
                  setKelompok(e.target.value);
                  setJejak([]);
                  setTingkat("kabupaten");
                }}
              >
                {menu.length === 0 ? <option value="perceraian">Perceraian (Gugat + Talak)</option> : null}
                {menu.map((m) => (
                  <option key={m.kunci} value={m.kunci}>
                    {m.nama} ({angka(m.perkara)})
                  </option>
                ))}
              </NativeSelect>
            </label>

            <label className="flex min-w-[9rem] flex-1 flex-col gap-1 text-xs text-muted-foreground">
              Tingkat wilayah
              <NativeSelect
                value={tingkat}
                onChange={(e) => {
                  setTingkat(e.target.value);
                  setJejak([]);
                }}
              >
                {TINGKAT.map((t) => (
                  <option key={t.nilai} value={t.nilai}>
                    {t.label}
                  </option>
                ))}
              </NativeSelect>
            </label>

            <label className="flex min-w-[8rem] flex-1 flex-col gap-1 text-xs text-muted-foreground">
              Periode
              <NativeSelect value={periode} onChange={(e) => setPeriode(e.target.value)}>
                {PERIODE.map((p) => (
                  <option key={p.nilai} value={p.nilai}>
                    {p.label}
                  </option>
                ))}
              </NativeSelect>
            </label>

            {periode !== "total" ? (
              <label className="flex min-w-[8.5rem] flex-col gap-1 text-xs text-muted-foreground">
                Tanggal acuan
                <input
                  type="date"
                  value={acuan}
                  onChange={(e) => setAcuan(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                />
              </label>
            ) : null}

            <label className="flex min-w-[9rem] flex-1 flex-col gap-1 text-xs text-muted-foreground">
              Bentuk grafik
              <NativeSelect value={bentuk} onChange={(e) => setBentuk(e.target.value as JenisGrafik)}>
                {JENIS_GRAFIK.map((j) => (
                  <option key={j.nilai} value={j.nilai}>
                    {j.label}
                  </option>
                ))}
              </NativeSelect>
            </label>
          </div>

          {hasil?.perceraian ? (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(hasil.penanda).map(([jenis, warna]) => (
                <span
                  key={jenis}
                  className={cn("rounded-full border px-2 py-0.5 text-xs", WARNA_PENANDA[warna] ?? "")}
                >
                  {jenis} · {angka(hasil.jenisMuncul[jenis] ?? 0)}
                </span>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {galat ? (
        <Card className="border-destructive/40">
          <CardContent className="py-4 text-sm text-destructive">{galat}</CardContent>
        </Card>
      ) : null}

      {memuat ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">Menyusun sebaran…</CardContent>
        </Card>
      ) : null}

      {hasil && !memuat ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Perkara diputus", nilai: angka(hasil.ringkas.diputus) },
              {
                label: "Beralamat",
                nilai: `${angka(hasil.ringkas.beralamat)} (${hasil.ringkas.persenBeralamat}%)`,
              },
              { label: "Perempuan mengajukan", nilai: `${hasil.ringkas.persenPerempuan}%` },
              { label: "Tempat terdaftar", nilai: angka(hasil.wilayah.length) },
            ].map((k) => (
              <Card key={k.label}>
                <CardContent className="py-4">
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{k.nilai}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* ==============================================================
              JANGKAUANNYA DISEBUT DI ATAS ANGKANYA

              Sebaran dari sebagian data akan tampak berwibawa sambil
              menyembunyikan sisanya. Angka itu harus dibaca lebih dahulu,
              bukan dicari di catatan kaki.
              ============================================================== */}
          {hasil.ringkas.persenBeralamat < 100 ? (
            <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                Hanya <strong>{angka(hasil.ringkas.beralamat)} dari {angka(hasil.ringkas.diputus)}</strong>{" "}
                perkara ({hasil.ringkas.persenBeralamat}%) yang alamatnya tercatat di SIPP. Sebaran di bawah
                menggambarkan bagian itu saja — bukan seluruh perkara. Tahun-tahun terakhir jauh lebih
                lengkap daripada yang lama.
              </span>
            </p>
          ) : null}

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{hasil.alasanTanpaPeta}</span>
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={lihat === "wilayah" ? "default" : "outline"}
              onClick={() => setLihat("wilayah")}
            >
              Sebaran wilayah
            </Button>
            {hasil.perceraian ? (
              <Button
                type="button"
                size="sm"
                variant={lihat === "faktor" ? "default" : "outline"}
                onClick={() => setLihat("faktor")}
              >
                Faktor perceraian
              </Button>
            ) : null}

            {jejak.length > 0 && lihat === "wilayah" ? (
              <>
                <Button type="button" size="sm" variant="ghost" onClick={kembali}>
                  <Undo2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  Kembali
                </Button>
                <span className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                  {jejak.map((j, i) => (
                    <span key={`${j.kode}-${i}`} className="flex items-center gap-1">
                      {i > 0 ? <ChevronRight className="h-3 w-3" aria-hidden /> : null}
                      {j.nama}
                    </span>
                  ))}
                </span>
              </>
            ) : null}
          </div>

          {dataGrafik.length > 0 ? (
            <Card>
              <CardContent className="pt-5">
                <LazyStatisticsChart type={bentuk} data={dataGrafik} />
                {daftar.length > 20 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Grafik menggambar 20 teratas dari {angka(daftar.length)}; daftar di bawah memuat
                    seluruhnya.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                {lihat === "faktor" ? "Faktor perceraian" : `Sebaran menurut ${tingkatIni?.label ?? tingkat}`}
              </CardTitle>
              <CardDescription>
                {lihat === "wilayah" && bisaTurun
                  ? "Ketuk satu baris untuk menelusuri turun ke tingkat berikutnya."
                  : lihat === "faktor"
                    ? "Dibaca dari akta cerai — terisi pada hampir seluruh akta yang terbit."
                    : "Tingkat terakhir; tidak ada lagi di bawahnya."}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[38rem] text-sm">
                  <thead className="border-b border-border text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium">{lihat === "faktor" ? "Faktor" : "Tempat"}</th>
                      <th className="px-3 py-2 text-right font-medium">Perkara</th>
                      <th className="px-3 py-2 text-right font-medium">Perempuan</th>
                      <th className="px-3 py-2 text-right font-medium">Laki-laki</th>
                      {hasil.perceraian ? <th className="px-3 py-2 font-medium">Rincian</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {daftar.map((t) => (
                      <tr
                        key={`${t.kode}-${t.nama}`}
                        onClick={() => turun(t)}
                        className={cn(
                          "border-b border-border/60 last:border-0",
                          bisaTurun && t.kode && "cursor-pointer hover:bg-muted/40"
                        )}
                      >
                        <td className="px-4 py-2">
                          <span className="flex items-center gap-1.5">
                            {bisaTurun && t.kode ? (
                              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                            ) : null}
                            {t.nama}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-medium tabular-nums">{angka(t.perkara)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{angka(t.perempuan)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{angka(t.lelaki)}</td>
                        {hasil.perceraian ? (
                          <td className="px-3 py-2">
                            <span className="flex flex-wrap gap-1">
                              {Object.entries(t.jenis)
                                .sort((a, b) => b[1] - a[1])
                                .map(([jenis, n]) => (
                                  <Badge
                                    key={jenis}
                                    variant="outline"
                                    className={cn("text-[0.65rem]", WARNA_PENANDA[hasil.penanda[jenis]] ?? "")}
                                  >
                                    {jenis} {angka(n)}
                                  </Badge>
                                ))}
                            </span>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
