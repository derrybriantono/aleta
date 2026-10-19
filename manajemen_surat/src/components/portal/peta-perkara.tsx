"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, Info, MapPin, Undo2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { apiPath, withBasePath } from "@/lib/base-path";
import { cn } from "@/lib/utils";

import { JENIS_GRAFIK, type JenisGrafik } from "@/components/portal/statistics-chart";
import type { TitikPerkara } from "@/components/portal/peta-titik-perkara";
import {
  KEADAAN_IKRAR,
  KUNCI_KELOMPOK_IKRAR,
  KUNCI_LAPISAN_IKRAR,
  kalimatSisaIkrar,
  pilihanUntukKelompok,
  simpanPilihan,
  type KelasPeta,
  type SisaKecamatan,
} from "@/lib/peta-perkara-ukur";

const LazyStatisticsChart = dynamic(
  () => import("@/components/portal/statistics-chart").then((m) => m.StatisticsChart),
  {
    ssr: false,
    loading: () => <div className="min-h-[300px] rounded-[1.4rem] border border-border bg-muted/30" />,
  }
);

/**
 * Peta dimuat HANYA ketika tab petanya dibuka.
 *
 * Leaflet beserta gayanya berukuran 162 KB dan berkas titik desanya menyusul
 * sesudah itu. Yang datang ke halaman ini kerap hanya ingin membaca daftar
 * sebaran - membuatnya menunggu pustaka peta yang tidak ia buka adalah ongkos
 * yang dibayar setiap orang demi sebagian orang.
 *
 * ssr:false, dan bukan sekadar demi kecepatan: Leaflet menyentuh `window` saat
 * modulnya dimuat, dan peladen tidak punya `window`.
 */
const LazyPetaTitik = dynamic(
  () => import("@/components/portal/peta-titik-perkara").then((m) => m.PetaTitikPerkara),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-[26rem] w-full place-items-center rounded-[0.9rem] border border-border bg-muted/30 text-sm text-muted-foreground sm:h-[32rem]">
        Memuat peta…
      </div>
    ),
  }
);

/**
 * Warna bulatan peta tidak lagi disusun di sini.
 *
 * Sejak peta dapat memilih golongan bulatannya sendiri (semua, cerai,
 * dispensasi, itsbat, lainnya), warnanya mengikuti KELAS jenis yang dihitung
 * bot lewat jenis_perkara_id - WARNA_KELAS di lib/peta-perkara-ukur.ts. Cerai
 * gugat tetap merah (#ef4444, red-500) dan cerai talak tetap biru (#3b82f6,
 * blue-500), sama dengan lencana WARNA_PENANDA di bawah.
 */

/**
 * Daftar kosong yang SATU, bukan yang baru tiap gambar ulang.
 *
 * `hasil.titik ?? []` melahirkan larik baru pada tiap penggambaran ketika
 * peladennya belum mengirim medan itu - versi bot yang lebih tua. Larik baru
 * berarti prop yang berubah, dan prop yang berubah membuat peta membuang lalu
 * menggambar ulang seluruh lingkarannya untuk data yang sama persis.
 */
const TANPA_TITIK: TitikPerkara[] = [];

type Tempat = {
  nama: string;
  kode: string;
  perkara: number;
  lelaki: number;
  perempuan: number;
  jenis: Record<string, number>;
};

/** Satu perkara cerai talak yang tenggat ikrarnya dekat atau sudah gugur. */
type PerkaraIkrar = {
  nomorPerkara: string;
  tempat: string;
  tanggalSidangIkrar: string;
  batas: string;
  sisaHari: number | null;
  ditetapkanGugur: boolean;
};

type DaftarIkrar = { jumlah: number; batas: number; daftar: PerkaraIkrar[] };

/** Keadaan ikrar talak - hanya ada ketika kelompok "Ikrar talak" dipilih. */
type RingkasIkrar = {
  hariIni: string;
  ambangDekatHari: number;
  jumlah: Record<string, number>;
  dekat: DaftarIkrar;
  gugur: DaftarIkrar;
};

type HasilPeta = {
  ok: boolean;
  alasan?: string;
  kelompok: string;
  kelompokNama: string;
  perceraian: boolean;
  ikrar?: RingkasIkrar;
  penanda: Record<string, string>;
  jenisMuncul: Record<string, number>;
  tingkat: string;
  induk: string;
  rentang: { dari: string; sampai: string };
  petaGeografis: boolean;
  alasanTanpaPeta: string;
  /**
   * Satu baris per desa, dikunci KODE wilayah - bukan nama. Lihat titikDesa.
   * Bila `titikSeluruhJenis`, isinya SELURUH jenis perkara pada rentang itu -
   * tidak disaring "Jenis perkara" di atas - dan tiap desa membawa `kelas`.
   */
  titik?: TitikPerkara[];
  titikSeluruhJenis?: boolean;
  /** Perkara tanpa kode desa (kolomnya kosong atau berisi tulisan). */
  titikTanpaKode?: number;
  titikTanpaKodeKelas?: Partial<Record<KelasPeta, number>>;
  titikTanpaKodeJenis?: Record<string, number>;
  /** Perkara berkode kecamatan tanpa kode desa - ikut label kecamatan di peta. */
  kecamatanTanpaDesa?: SisaKecamatan[];
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

type MenuJenis = {
  kunci: string;
  nama: string;
  perkara: number;
  gabungan: boolean;
  /** Kelompok "Ikrar talak": keadaan ikrar, bukan jenis perkara. */
  ikrar?: boolean;
  /** Golongan bulatan peta untuk pilihan ini - lewat jenis_perkara_id di bot. */
  golongan?: string;
};

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
  // Penanda keadaan ikrar talak (kelompok "Ikrar talak").
  hijau: "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  kuning: "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  kelabu: "border-slate-400/50 bg-slate-400/10 text-slate-700 dark:text-slate-300",
  ungu: "border-purple-500/50 bg-purple-500/10 text-purple-700 dark:text-purple-300",
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
  const [lihat, setLihat] = useState<"peta" | "wilayah" | "faktor">("peta");

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
                  // Memilih jenis perkara di sini ikut memilih bulatan peta
                  // yang sepadan: Perceraian -> golongan cerai, satu jenis
                  // (Kewarisan, Dispensasi Kawin, ...) -> TEPAT jenis itu.
                  // Disimpan ke INGATAN peta, bukan diteruskan lewat prop:
                  // petanya dilahirkan ulang sesudah data baru tiba, dan yang
                  // dibacanya saat lahir ingatan itu. Pilihan bulatan di peta
                  // tetap bebas diganti sesudahnya.
                  //
                  // Telaah 2.40.0: dahulu golongan jenis itu yang ditulis
                  // ("lainnya" untuk Kewarisan), dan bulatannya memuat seluruh
                  // golongan sementara tabel di bawahnya hanya Kewarisan.
                  const m = menu.find((x) => x.kunci === e.target.value);
                  const gabungan = m ? m.gabungan : e.target.value === "perceraian";
                  simpanPilihan(pilihanUntukKelompok(!(gabungan || m?.ikrar), m?.golongan));
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
              {
                label: hasil.ikrar ? "Cerai talak dikabulkan" : "Perkara diputus",
                nilai: angka(hasil.ringkas.diputus),
              },
              {
                label: "Beralamat",
                nilai: `${angka(hasil.ringkas.beralamat)} (${hasil.ringkas.persenBeralamat}%)`,
              },
              hasil.ikrar
                ? { label: "Tenggat dekat", nilai: angka(hasil.ikrar.jumlah.dekat ?? 0) }
                : { label: "Perempuan mengajukan", nilai: `${hasil.ringkas.persenPerempuan}%` },
              hasil.ikrar
                ? { label: "Gugur", nilai: angka(hasil.ikrar.jumlah.gugur ?? 0) }
                : { label: "Tempat terdaftar", nilai: angka(hasil.wilayah.length) },
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

          {hasil.ikrar ? <KeadaanIkrar ikrar={hasil.ikrar} penanda={hasil.penanda} /> : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={lihat === "peta" ? "default" : "outline"}
              onClick={() => setLihat("peta")}
            >
              <MapPin className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Peta
            </Button>
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

          {/* ==============================================================
              PETA TITIK - hanya saat tabnya dibuka
              ==============================================================

              Pustaka petanya baru diunduh ketika tab ini dipilih; yang datang
              untuk membaca daftar tidak ikut menunggunya. */}
          {lihat === "peta" ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Peta sebaran per desa</CardTitle>
                <CardDescription>
                  Satu lingkaran per desa; luasnya sebanding dengan jumlah perkara golongan yang
                  dipilih di atas peta — semua perkara, cerai, dispensasi kawin, itsbat nikah, atau
                  lainnya. Perbesar peta untuk garis dan jumlah perkara tiap kecamatan. Arahkan
                  penunjuk ke satu lingkaran untuk melihat rinciannya.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LazyPetaTitik
                  // Berganti ke/dari Ikrar talak melahirkan peta baru, supaya
                  // lapisan awalnya (Keadaan ikrar talak) benar-benar terbuka.
                  key={hasil.ikrar ? "ikrar" : "umum"}
                  lapisanAwal={hasil.ikrar ? KUNCI_LAPISAN_IKRAR : undefined}
                  titik={hasil.titik ?? TANPA_TITIK}
                  tanpaKode={hasil.titikTanpaKode ?? 0}
                  tanpaKodeKelas={hasil.titikTanpaKodeKelas}
                  tanpaKodeJenis={hasil.titikTanpaKodeJenis}
                  kecamatanTanpaDesa={hasil.kecamatanTanpaDesa}
                  // Jenis TUNGGAL halaman - bulatan dapat menghitung tepat
                  // jenis itu, sama dengan tabel di bawahnya. Kosong untuk
                  // kelompok gabungan (Perceraian).
                  jenisTerpilih={hasil.perceraian || hasil.ikrar ? "" : hasil.kelompok}
                  golonganJenis={menu.find((m) => m.kunci === hasil.kelompok)?.golongan}
                  saringan={{
                    // Ikrar talak bukan jenis perkara: desa yang diketuk
                    // dibuka sebagai daftar perceraian (golongan cerai).
                    kelompok: kelompok === KUNCI_KELOMPOK_IKRAR ? "perceraian" : kelompok,
                    periode,
                    acuan,
                    dari: hasil.rentang.dari,
                    sampai: hasil.rentang.sampai,
                  }}
                />
              </CardContent>
            </Card>
          ) : null}

          {lihat !== "peta" && dataGrafik.length > 0 ? (
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
                    : lihat === "peta"
                      ? "Mengikuti pilihan Jenis perkara di atas halaman, dalam bentuk yang dapat dibaca berurutan — termasuk desa yang belum punya titik. Bulatan peta mengikuti pilihan golongannya sendiri; angkanya sama bila golongannya sepadan."
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
                      {hasil.ikrar ? null : (
                        <>
                          <th className="px-3 py-2 text-right font-medium">Perempuan</th>
                          <th className="px-3 py-2 text-right font-medium">Laki-laki</th>
                        </>
                      )}
                      {hasil.perceraian || hasil.ikrar ? <th className="px-3 py-2 font-medium">Rincian</th> : null}
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
                        {hasil.ikrar ? null : (
                          <>
                            <td className="px-3 py-2 text-right tabular-nums">{angka(t.perempuan)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{angka(t.lelaki)}</td>
                          </>
                        )}
                        {hasil.perceraian || hasil.ikrar ? (
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

/**
 * Keadaan ikrar talak: arti tiap warna (dengan jumlahnya), lalu dua daftar
 * ringkas - tenggat dekat dan gugur - yang nomor perkaranya membuka Status
 * Perkara. Dibaca dari perkara cerai talak yang dikabulkan pada rentang
 * peta; batas enam bulan dihitung sejak hari sidang ikrar ditetapkan.
 */
function KeadaanIkrar({ ikrar, penanda }: { ikrar: RingkasIkrar; penanda: Record<string, string> }) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Keadaan ikrar talak</CardTitle>
          <CardDescription>
            Perkara cerai talak yang dikabulkan pada periode ini. Ikrar talak harus diucapkan paling lambat
            enam bulan sejak hari sidang ikrar ditetapkan; keadaan dihitung per hari ini.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2">
            {KEADAAN_IKRAR.map((k) => (
              <li key={k.kunci} className="flex items-start gap-2 text-sm">
                <span
                  aria-hidden
                  className="mt-1 h-3 w-3 shrink-0 rounded-full border border-black/10"
                  style={{ backgroundColor: k.warna }}
                />
                <span>
                  <span
                    className={cn(
                      "mr-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
                      WARNA_PENANDA[penanda[k.label]] ?? ""
                    )}
                  >
                    {k.label} · {angka(ikrar.jumlah[k.kunci] ?? 0)}
                  </span>
                  <span className="text-xs text-muted-foreground">{k.kalimat}</span>
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <DaftarPerhatianIkrar
          judul="Tenggat dekat"
          kosong={`Tidak ada perkara yang batas ikrarnya tinggal ${ikrar.ambangDekatHari} hari atau kurang.`}
          data={ikrar.dekat}
        />
        <DaftarPerhatianIkrar
          judul="Gugur"
          kosong="Tidak ada perkara yang gugur pada periode ini."
          data={ikrar.gugur}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Kedua daftar memuat semua perkara pada periode, termasuk yang alamatnya belum tercatat. Ketuk nomor
        perkara untuk membuka Status Perkara.
      </p>
    </div>
  );
}

function DaftarPerhatianIkrar({ judul, kosong, data }: { judul: string; kosong: string; data: DaftarIkrar }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">
          {judul} · {angka(data.jumlah)}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {data.daftar.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">{kosong}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[22rem] text-sm">
              <thead className="border-b border-border text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Perkara</th>
                  <th className="px-3 py-2 font-medium">Batas ikrar</th>
                  <th className="px-3 py-2 font-medium">Sisa waktu</th>
                </tr>
              </thead>
              <tbody>
                {data.daftar.map((p) => (
                  <tr key={p.nomorPerkara} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-2">
                      <a
                        href={withBasePath(`/aleta-ecourt?perkara=${encodeURIComponent(p.nomorPerkara)}`)}
                        className="font-medium text-primary underline-offset-2 hover:underline"
                      >
                        {p.nomorPerkara}
                      </a>
                      <span className="block text-xs text-muted-foreground">
                        {p.tempat || "alamat belum tercatat"}
                      </span>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{p.batas || "—"}</td>
                    <td className="px-3 py-2">
                      {kalimatSisaIkrar(p.sisaHari)}
                      {p.ditetapkanGugur ? (
                        <span className="block text-xs text-muted-foreground">penetapan gugur sudah terbit</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.jumlah > data.daftar.length ? (
              <p className="px-4 py-2 text-xs text-muted-foreground">
                Menampilkan {angka(data.daftar.length)} dari {angka(data.jumlah)}.
              </p>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
