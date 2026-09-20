"use client";

import dynamic from "next/dynamic";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, Info, ScrollText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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

type Rincian = { sebab: string; tambah?: number; kali?: number };

type PerkaraKonseptor = {
  nomorPerkara: string;
  jenisPerkara: string;
  ragam: string;
  pihak: number;
  banding: boolean;
  tanggalPutusan: string;
  statusPutusan: string;
  verstek: boolean;
  saksi: number;
  sidang: number;
  aksara: number;
  skor: number;
  rincian: Rincian[];
};

type SumbuKonseptor = {
  /** Berapa berat yang dipikul - skor berbobotnya. */
  beban: number;
  /** Berapa persen berkasnya lengkap: naskah tersimpan DAN amar teranonimisasi. */
  kelengkapan: number;
  /** Berapa persen perkaranya lebih berat daripada median satker. */
  keragaman: number;
};

type BarisKonseptor = {
  nama: string;
  putusan: number;
  skor: number;
  rataSkor: number;
  tengahSkor: number | null;
  bulanAktif: number;
  aktifDari: string;
  aktifSampai: string;
  skorPerBulan: number;
  putusanPerBulan: number;
  sumbu: SumbuKonseptor;
  pihak: number;
  rataPihak: number;
  mediasi: number;
  kuasa: number;
  banding: number;
  verstek: number;
  contradictoir: number;
  rekonvensi: number;
  putusanSela: number;
  saksi: number;
  sidang: number;
  aksara: number;
  rataAksara: number;
  rataSidang: number;
  anonimLengkap: number;
  tengahJedaMinutasi: number | null;
  status: Record<string, number>;
  jenis: Record<string, number>;
  perkara: PerkaraKonseptor[];
};

type HasilKonseptor = {
  available?: boolean;
  ok: boolean;
  alasan?: string;
  periode: string;
  dasar: string;
  rentang: { dari: string; sampai: string };
  kolomMinutasiMati: boolean;
  /** Bobot yang BERLAKU pada perhitungan ini - untuk dibandingkan dengan usulnya. */
  bobot: Record<string, unknown>;
  padam: Record<string, string>;
  rincianDimatikan: boolean;
  batasRincian: number;
  ringkas: {
    konseptor: number;
    putusan: number;
    skor: number;
    rataSkorPerPutusan: number;
    medianSkorPerPutusan: number;
    banding: number;
  };
  bacaan: { nada: string; teks: string; nama?: string[] }[];
  usulBobot?: UsulBobot;
  daftar: BarisKonseptor[];
};

/**
 * Bobot yang diturunkan dari riwayat satker sendiri - tandingan bagi bobot
 * karangan. Selalu ditampilkan BERDAMPINGAN dengan yang berlaku, tidak pernah
 * menggantikannya diam-diam.
 */
type UsulBobot = {
  ok: boolean;
  alasan?: string;
  perkara?: number;
  rKuadrat?: number;
  teramati?: Record<string, number>;
  dinolkan?: { nama: string; nilaiAsli: number }[];
  usul?: Record<string, number>;
  usulPenggandaJenis?: Record<string, number>;
  keterangan?: string;
};

const PERIODE: { nilai: string; label: string }[] = [
  { nilai: "minggu", label: "Minggu ini" },
  { nilai: "bulan", label: "Bulan" },
  { nilai: "triwulan", label: "Triwulan" },
  { nilai: "semester", label: "Semester" },
  { nilai: "tahun", label: "Tahun" },
  { nilai: "total", label: "Seluruhnya" },
  { nilai: "rentang", label: "Rentang tanggal sendiri" },
];

/**
 * Keempatnya menghitung pekerjaan yang BERBEDA, dan keterangannya ikut di layar
 * - bukan hanya di dalam kode. Pengguna yang memilih "penginput" tanpa tahu
 * artinya akan membaca peringkat mengetik sebagai peringkat mengarang.
 *
 * Yang pertama menjadi bawaannya, dan urutannya bukan selera: yang paling
 * sering benar diletakkan paling atas, sebab daftar pilihan dibaca dari atas
 * dan yang di bawah jarang dibuka.
 */
const DASAR: { nilai: string; label: string; arti: string }[] = [
  {
    nilai: "konseptor",
    label: "Konseptor putusan",
    arti:
      "Yang mengunggah putusan pada tahapan putusan di SIPP - sumber yang sama dengan Konseptor pada layar Status Perkara. Inilah yang menulis putusannya.",
  },
  {
    nilai: "ketua-majelis",
    label: "Ketua majelis",
    arti: "Hakim ketua pada perkara itu - yang bertanggung jawab atas konsepnya, belum tentu yang menulisnya.",
  },
  {
    nilai: "penginput",
    label: "Penginput SIPP",
    arti: "Akun yang mengetikkan putusannya ke SIPP. Ini mengukur pekerjaan mengetik, bukan mengarang.",
  },
  {
    nilai: "panitera",
    label: "Panitera pengganti",
    arti: "Panitera pengganti pada perkara itu.",
  },
];

const angka = (n: number) => n.toLocaleString("id-ID");
const skorTeks = (n: number) => n.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function hariIni() {
  const d = new Date();
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Nada bacaan dipetakan ke warna semantik, bukan ke warna kategori grafik. */
const NADA: Record<string, string> = {
  perhatian: "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200",
  "tidak-terpakai": "border-border bg-muted/40 text-muted-foreground",
  biasa: "border-border bg-card text-foreground",
};

export function BebanKonseptor() {
  const [periode, setPeriode] = useState("tahun");
  const [dasar, setDasar] = useState(DASAR[0].nilai);
  const [acuan, setAcuan] = useState(hariIni());
  const [dari, setDari] = useState(`${new Date().getFullYear()}-01-01`);
  const [sampai, setSampai] = useState(hariIni());
  const [bentuk, setBentuk] = useState<JenisGrafik>("bar-h");
  const [ukuran, setUkuran] = useState<
    "skor" | "skorPerBulan" | "putusan" | "rataSkor" | "tengahSkor" | "aksara" | "kelengkapan" | "keragaman"
  >("skor");
  const [terbuka, setTerbuka] = useState<string | null>(null);
  const [mintaUsul, setMintaUsul] = useState(false);

  const [hasil, setHasil] = useState<HasilKonseptor | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const ambil = useCallback(async () => {
    setMemuat(true);
    setGalat(null);
    try {
      const kueri = new URLSearchParams({ periode, dasar, acuan });
      if (mintaUsul) kueri.set("usulBobot", "1");
      if (periode === "rentang") {
        kueri.set("dari", dari);
        kueri.set("sampai", sampai);
      }
      const balasan = await fetch(apiPath(`/api/aleta-ecourt/konseptor?${kueri.toString()}`), {
        cache: "no-store",
      });
      // Rute portal menjawab lewat ok(), yang MEMBUNGKUS muatannya sebagai
      // { ok: true, data: {...} }. Membaca isi.ok langsung berarti membaca ok
      // milik bungkusnya - selalu true - sehingga cabang gagal tidak pernah
      // menyala meski peladen sudah menyiapkan alasannya.
      const isi = (((await balasan.json()) as { data?: HasilKonseptor })?.data ?? {}) as HasilKonseptor;
      if (!isi.ok) {
        setHasil(null);
        setGalat(isi.alasan || "Perhitungan tidak dapat diselesaikan.");
      } else {
        setHasil(isi);
      }
    } catch (e) {
      setHasil(null);
      setGalat(e instanceof Error ? e.message : "Perhitungan tidak dapat diselesaikan.");
    } finally {
      setMemuat(false);
    }
  }, [periode, dasar, acuan, dari, sampai, mintaUsul]);

  useEffect(() => {
    void ambil();
  }, [ambil]);

  const dataGrafik = useMemo(() => {
    if (!hasil) return [];
    const ambilNilai = (o: BarisKonseptor) => {
      if (ukuran === "putusan") return o.putusan;
      if (ukuran === "skorPerBulan") return o.skorPerBulan;
      if (ukuran === "rataSkor") return o.rataSkor;
      if (ukuran === "tengahSkor") return o.tengahSkor ?? 0;
      if (ukuran === "aksara") return o.aksara;
      if (ukuran === "kelengkapan") return o.sumbu.kelengkapan;
      if (ukuran === "keragaman") return o.sumbu.keragaman;
      return o.skor;
    };
    return hasil.daftar.map((o) => ({ label: o.nama, value: ambilNilai(o) }));
  }, [hasil, ukuran]);

  const artiDasar = DASAR.find((d) => d.nilai === dasar)?.arti ?? "";

  return (
    <div className="flex flex-col gap-5">
      {/* ------------------------------------------------------------------ */}
      {/* Saringan - satu baris di atas grafiknya, bukan tersebar di layar.  */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Beban kinerja konseptor</CardTitle>
          <CardDescription>
            Bobot tiap putusan disusun dari yang tercatat SIPP: verstek atau contradictoir, status putusannya,
            rekonvensi, putusan sela, jumlah saksi, jumlah sidang, dan panjang naskah pertimbangannya.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[9rem] flex-1 flex-col gap-1 text-xs text-muted-foreground">
              Periode
              <NativeSelect value={periode} onChange={(e) => setPeriode(e.target.value)}>
                {PERIODE.map((p) => (
                  <option key={p.nilai} value={p.nilai}>
                    {p.label}
                  </option>
                ))}
              </NativeSelect>
            </label>

            {periode === "rentang" ? (
              <>
                <label className="flex min-w-[8.5rem] flex-col gap-1 text-xs text-muted-foreground">
                  Dari tanggal
                  <input
                    type="date"
                    value={dari}
                    onChange={(e) => setDari(e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  />
                </label>
                <label className="flex min-w-[8.5rem] flex-col gap-1 text-xs text-muted-foreground">
                  Sampai tanggal
                  <input
                    type="date"
                    value={sampai}
                    onChange={(e) => setSampai(e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  />
                </label>
              </>
            ) : periode === "total" ? null : (
              <label className="flex min-w-[8.5rem] flex-col gap-1 text-xs text-muted-foreground">
                Tanggal acuan
                <input
                  type="date"
                  value={acuan}
                  onChange={(e) => setAcuan(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                />
              </label>
            )}

            <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs text-muted-foreground">
              Dihitung atas
              <NativeSelect value={dasar} onChange={(e) => setDasar(e.target.value)}>
                {DASAR.map((d) => (
                  <option key={d.nilai} value={d.nilai}>
                    {d.label}
                  </option>
                ))}
              </NativeSelect>
            </label>

            <label className="flex min-w-[9rem] flex-1 flex-col gap-1 text-xs text-muted-foreground">
              Yang digambar
              <NativeSelect value={ukuran} onChange={(e) => setUkuran(e.target.value as typeof ukuran)}>
                <option value="skor">Skor beban</option>
                <option value="skorPerBulan">Skor per bulan aktif</option>
                <option value="putusan">Jumlah putusan</option>
                <option value="rataSkor">Berat rata-rata per putusan</option>
                <option value="tengahSkor">Berat median per putusan</option>
                <option value="aksara">Jumlah aksara pertimbangan</option>
                <option value="kelengkapan">Kelengkapan berkas (%)</option>
                <option value="keragaman">Bagian perkara berat (%)</option>
              </NativeSelect>
            </label>

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

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{artiDasar}</span>
          </p>

          {/* ================================================================
              BOBOT YANG DITURUNKAN DARI DATA SATKER SENDIRI

              Kelemahan terbesar bobot bawaan: ia karangan yang masuk akal,
              bukan kenyataan. Tombol ini menawarkan tandingannya - dan
              menampilkannya BERDAMPINGAN, tidak pernah menggantikan diam-diam.
              ================================================================ */}
          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={mintaUsul}
              onChange={(e) => setMintaUsul(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 shrink-0"
            />
            <span>
              Hitung juga usul bobot dari riwayat satker sendiri — memakai jumlah sidang dan panjang naskah
              sebagai berat teramati, lalu mencari bobot komponen lain yang paling mendekatinya.
            </span>
          </label>
        </CardContent>
      </Card>

      {galat ? (
        <Card className="border-destructive/40">
          <CardContent className="py-4 text-sm text-destructive">{galat}</CardContent>
        </Card>
      ) : null}

      {memuat ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">Menghitung…</CardContent>
        </Card>
      ) : null}

      {hasil && !memuat ? (
        <>
          {/* ---------------------------------------------------------- */}
          {/* Angka mentahnya berdampingan dengan skornya - tidak pernah  */}
          {/* digantikan olehnya.                                         */}
          {/* ---------------------------------------------------------- */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Konseptor", nilai: angka(hasil.ringkas.konseptor) },
              { label: "Putusan", nilai: angka(hasil.ringkas.putusan) },
              { label: "Jumlah skor beban", nilai: skorTeks(hasil.ringkas.skor) },
              {
                label: "Berat per putusan (rata / median)",
                nilai: `${skorTeks(hasil.ringkas.rataSkorPerPutusan)} / ${skorTeks(
                  hasil.ringkas.medianSkorPerPutusan
                )}`,
              },
            ].map((k) => (
              <Card key={k.label}>
                <CardContent className="py-4">
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{k.nilai}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            {hasil.rentang.dari} sampai {hasil.rentang.sampai} · dihitung atas{" "}
            {DASAR.find((d) => d.nilai === hasil.dasar)?.label ?? hasil.dasar}
          </p>

          {/* ---------------------------------------------------------- */}
          {/* Bacaan - tiap kalimat menyebut angka penopangnya.           */}
          {/* ---------------------------------------------------------- */}
          {/* ============================================================
              KOMPONEN YANG PADAM DISEBUT DI ATAS ANGKANYA

              Komponen yang tidak pernah menyala lebih buruk daripada komponen
              yang tidak ada: ia TERLIHAT bekerja. Daftarnya karena itu berdiri
              sendiri di sini, bukan cuma terselip di antara kalimat bacaan.
              ============================================================ */}
          {Object.values(hasil.padam ?? {}).some(Boolean) ? (
            <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2">
              {Object.entries(hasil.padam ?? {})
                .filter(([, sebab]) => Boolean(sebab))
                .map(([nama, sebab]) => (
                  <p key={nama} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>{sebab}</span>
                  </p>
                ))}
            </div>
          ) : null}

          {hasil.bacaan.length > 0 ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Analisis kinerja</CardTitle>
                <CardDescription>
                  Tiap kalimat menyebut angka yang menopangnya, supaya dapat dibantah dengan menunjuk angka.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {hasil.bacaan.map((b, i) => (
                  <div
                    key={i}
                    className={cn("flex items-start gap-2 rounded-lg border px-3 py-2 text-sm", NADA[b.nada] ?? NADA.biasa)}
                  >
                    {b.nada === "perhatian" ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    ) : (
                      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    )}
                    <span>{b.teks}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {hasil.usulBobot ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Usul bobot dari data satker</CardTitle>
                <CardDescription>
                  {hasil.usulBobot.ok
                    ? hasil.usulBobot.keterangan
                    : `Belum dapat disusun: ${hasil.usulBobot.alasan}${
                        hasil.usulBobot.perkara !== undefined ? ` (${angka(hasil.usulBobot.perkara)} perkara)` : ""
                      }.`}
                </CardDescription>
              </CardHeader>
              {hasil.usulBobot.ok && hasil.usulBobot.usul ? (
                <CardContent className="overflow-x-auto p-0">
                  <table className="w-full min-w-[30rem] text-sm">
                    <thead className="border-b border-border text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2 font-medium">Komponen</th>
                        <th className="px-3 py-2 text-right font-medium">Berlaku</th>
                        <th className="px-3 py-2 text-right font-medium">Usul dari data</th>
                        <th className="px-3 py-2 text-right font-medium">Teramati</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(hasil.usulBobot.usul).map(([nama, nilai]) => {
                        const berlaku = (hasil.bobot as Record<string, unknown>)[nama];
                        const n = hasil.usulBobot?.teramati?.[nama];
                        return (
                          <tr key={nama} className="border-b border-border/60 last:border-0">
                            <td className="px-4 py-2">{nama}</td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {typeof berlaku === "number" ? skorTeks(berlaku) : "—"}
                            </td>
                            <td className="px-3 py-2 text-right font-medium tabular-nums">{skorTeks(nilai)}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                              {n === undefined ? "—" : angka(n)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p className="px-4 py-3 text-xs text-muted-foreground">
                    Angka ini tidak dipakai sendiri — ia diperlihatkan supaya bobot yang berlaku dapat
                    dibandingkan dengan apa yang sebenarnya terjadi di satker ini.
                  </p>
                </CardContent>
              ) : null}
            </Card>
          ) : null}

          {dataGrafik.length > 0 ? (
            <Card>
              <CardContent className="pt-5">
                <LazyStatisticsChart type={bentuk} data={dataGrafik} />
              </CardContent>
            </Card>
          ) : null}

          {/* ---------------------------------------------------------- */}
          {/* Daftar berlabel - dan tiap baris dapat DIBUKA rinciannya.   */}
          {/* Inilah yang membuat angkanya dapat dibantah.                */}
          {/* ---------------------------------------------------------- */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Rincian per konseptor</CardTitle>
              <CardDescription>
                {hasil.rincianDimatikan
                  ? `Rentang ini berisi ${angka(hasil.ringkas.putusan)} putusan - daftar perkaranya tidak ` +
                    `dibuka di atas ${angka(hasil.batasRincian)} putusan. Persempit rentangnya untuk melihatnya.`
                  : "Ketuk satu baris untuk melihat perkara apa saja yang menyusun angkanya."}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[62rem] text-sm">
                  <thead className="border-b border-border text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium">Konseptor</th>
                      <th className="px-3 py-2 text-right font-medium">Putusan</th>
                      <th className="px-3 py-2 text-right font-medium">Skor</th>
                      <th className="px-3 py-2 text-right font-medium" title="Skor dibagi bulan aktif">
                        Per bulan
                      </th>
                      <th className="px-3 py-2 text-right font-medium">Rata / median</th>
                      <th
                        className="px-3 py-2 text-right font-medium"
                        title="Naskah pertimbangan tersimpan dan amar teranonimisasi"
                      >
                        Lengkap
                      </th>
                      <th
                        className="px-3 py-2 text-right font-medium"
                        title="Bagian perkaranya yang lebih berat daripada median satker"
                      >
                        Berat
                      </th>
                      <th className="px-3 py-2 text-right font-medium">Verstek/Ct</th>
                      <th className="px-3 py-2 text-right font-medium">Saksi</th>
                      <th className="px-3 py-2 text-right font-medium">Sidang/perkara</th>
                      <th className="px-3 py-2 text-right font-medium">Aksara rata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hasil.daftar.map((o) => (
                      <Fragment key={o.nama}>
                        <tr
                          onClick={() => setTerbuka(terbuka === o.nama ? null : o.nama)}
                          className={cn(
                            "border-b border-border/60 last:border-0",
                            o.perkara.length > 0 && "cursor-pointer hover:bg-muted/40"
                          )}
                        >
                          <td className="px-4 py-2">
                            <span className="flex items-center gap-1.5">
                              {o.perkara.length > 0 ? (
                                <ChevronDown
                                  className={cn(
                                    "h-3.5 w-3.5 shrink-0 transition-transform",
                                    terbuka === o.nama ? "rotate-0" : "-rotate-90"
                                  )}
                                  aria-hidden
                                />
                              ) : (
                                <span className="w-3.5" />
                              )}
                              {o.nama}
                              {o.rataAksara === 0 ? (
                                <Badge variant="outline" className="ml-1 text-[0.65rem]">
                                  tanpa naskah
                                </Badge>
                              ) : null}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{angka(o.putusan)}</td>
                          <td className="px-3 py-2 text-right font-medium tabular-nums">{skorTeks(o.skor)}</td>
                          <td
                            className="px-3 py-2 text-right tabular-nums"
                            title={`${o.bulanAktif} bulan aktif: ${o.aktifDari} sampai ${o.aktifSampai}`}
                          >
                            {skorTeks(o.skorPerBulan)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {skorTeks(o.rataSkor)} / {o.tengahSkor === null ? "—" : skorTeks(o.tengahSkor)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{o.sumbu.kelengkapan}%</td>
                          <td className="px-3 py-2 text-right tabular-nums">{o.sumbu.keragaman}%</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {angka(o.verstek)}/{angka(o.contradictoir)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{angka(o.saksi)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{o.rataSidang}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{angka(o.rataAksara)}</td>
                        </tr>
                        {terbuka === o.nama && o.perkara.length > 0 ? (
                          <tr className="border-b border-border/60 bg-muted/20">
                            <td colSpan={12} className="px-4 py-3">
                              <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                                <ScrollText className="h-3.5 w-3.5" aria-hidden />
                                {angka(o.perkara.length)} perkara, diurut dari yang terberat
                              </p>
                              <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto pr-1">
                                {o.perkara.map((p) => (
                                  <div
                                    key={p.nomorPerkara}
                                    className="rounded-md border border-border bg-card px-3 py-2 text-xs"
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <span className="font-medium">{p.nomorPerkara}</span>
                                      <span className="tabular-nums">skor {skorTeks(p.skor)}</span>
                                    </div>
                                    <p className="mt-0.5 text-muted-foreground">
                                      {p.jenisPerkara} · {p.ragam} · {p.tanggalPutusan} · {p.statusPutusan} ·{" "}
                                      {p.verstek ? "verstek" : "contradictoir"}
                                      {p.banding ? " · dibanding" : ""}
                                    </p>
                                    <p className="mt-1 text-muted-foreground">
                                      {p.rincian
                                        .map((r) =>
                                          r.kali !== undefined
                                            ? `${r.sebab} x${r.kali}`
                                            : `${r.sebab} +${skorTeks(r.tambah ?? 0)}`
                                        )
                                        .join(" · ")}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
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
