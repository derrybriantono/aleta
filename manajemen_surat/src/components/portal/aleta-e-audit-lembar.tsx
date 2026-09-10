"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  HasilPenilaianTampil,
  warnaNilai,
  type HasilPenilaian,
} from "@/components/portal/penilaian-hasil";
import { apiPath } from "@/lib/base-path";

/**
 * ============================================================================
 * LEMBAR AUDIT SATU BAB - MENJALANKAN, BUKAN MENDAFTAR
 * ============================================================================
 *
 * Layar e-Audit yang sudah ada menampilkan KATALOG: butir mana yang sudah
 * tersambung dan butir mana yang belum. Itu jawaban atas pertanyaan "sejauh
 * mana aplikasinya jadi", dan bukan pertanyaan yang dibawa seorang pengawas.
 *
 * Yang dibawa pengawas: "bagaimana keadaan satuan kerja ini pada Bab 10
 * triwulan lalu, dan mana berkasnya yang perlu saya buka." Lembar ini
 * menjawab itu - ia MENJALANKAN tiap butir bab yang dipilih, lalu menyusun
 * hasilnya menjadi satu lembar yang dapat dibaca berurutan.
 *
 * ============================================================================
 * TIDAK ADA SATU ANGKA UNTUK SELURUH BAB - DAN ITU DISENGAJA
 * ============================================================================
 *
 * Godaan terbesar pada layar semacam ini menambahkan satu angka besar di
 * atas: "Nilai Bab 10: 87". Angka itu tidak boleh ada, dan sebabnya bukan
 * selera.
 *
 * Butir-butir dalam satu bab punya penyebut yang sama sekali berbeda -
 * 431 perkara, 907 persidangan, 4 ketua majelis, 10 angka papan nilai.
 * Merata-ratakan persentasenya memberi butir berpenyebut empat bobot yang
 * sama dengan butir berpenyebut sembilan ratus. Menimbangnya menurut
 * penyebut lebih buruk lagi: butir terbesar akan menelan seluruh bab, dan
 * satu kolom yang tidak pernah diisi dapat menenggelamkan tiga belas butir
 * yang baik.
 *
 * Yang ditampilkan di atas karena itu SEBARAN - berapa butir hijau, kuning,
 * merah, dan berapa yang penyebutnya terlalu kecil untuk dinilai. Sebaran
 * tidak dapat diringkas menjadi peringkat, dan memang tidak boleh.
 *
 * ============================================================================
 * DIJALANKAN SATU PER SATU, DAN HASILNYA MUNCUL SAMBIL BERJALAN
 * ============================================================================
 *
 * Tiap butir adalah satu permintaan tersendiri - itu aturan yang sudah
 * dipegang rute /api/aleta-penilaian/jalankan, dan lembar ini tidak
 * melanggarnya. Satu bab dapat memuat enam belas butir, dan beberapa di
 * antaranya membaca ribuan baris SIPP; menjalankan seluruhnya dalam satu
 * permintaan berarti layar menunggu tanpa tanda kehidupan sampai penunggunya
 * menyangka aplikasinya mati.
 *
 * Karena itu butir dijalankan berurutan dan hasilnya muncul begitu selesai.
 * Yang gagal tetap ditampilkan beserta sebabnya - butir yang hilang dari
 * lembar audit lebih berbahaya daripada butir yang merah.
 */

type ApiEnvelope<T> = { ok?: boolean; data?: T; error?: { message?: string } };

type Bab = { no: number; nama: string; jumlah: number };

type KeadaanButir = "penuh" | "sebagian" | "belum" | "putus";

type Butir = {
  kode: string;
  bab: number;
  nama: string;
  keterangan: string;
  keadaan: KeadaanButir;
  kunci: string | null;
  catatanSambungan: string;
};

type Katalog = {
  available?: boolean;
  ok?: boolean;
  alasan?: string;
  bab?: Bab[];
  butir?: Butir[];
};

/** Satu baris lembar: butirnya, dan hasil menjalankannya bila sudah ada. */
type BarisLembar = {
  butir: Butir;
  keadaan: "menunggu" | "berjalan" | "selesai" | "gagal" | "dilewati";
  hasil: HasilPenilaian | null;
  sebab: string;
};

const PERIODE = [
  { jenis: "bulanan", label: "Bulanan" },
  { jenis: "triwulan", label: "Triwulan" },
  { jenis: "semester", label: "Semester" },
  { jenis: "tahunan", label: "Tahunan" },
];

async function ambilJson<T>(alamat: string): Promise<T> {
  const respons = await fetch(apiPath(alamat), { cache: "no-store" });
  const isi = (await respons.json()) as ApiEnvelope<T>;
  return (isi.data ?? (isi as unknown)) as T;
}

function tanggalHariIni(): string {
  const d = new Date();
  const b = String(d.getMonth() + 1).padStart(2, "0");
  const h = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${b}-${h}`;
}

/**
 * Nilai satu butir untuk lembar ini: nilai satuan TERAKHIR yang dapat dinilai.
 *
 * Satu penilaian dapat memulangkan beberapa satuan - triwulan berisi tiga
 * bulan. Yang dipakai di lembar satuan terakhir, sebab itulah keadaan
 * terkini; menjumlahkan seluruh satuan akan mencampur bulan yang buruk dengan
 * bulan yang sudah diperbaiki menjadi satu angka yang tidak menggambarkan
 * keduanya.
 */
function nilaiTerkini(hasil: HasilPenilaian | null): {
  nilai: number | null;
  terpenuhi: number | null;
  penyebut: number | null;
  sebabTidakCukup: string;
} {
  const satuan = hasil?.satuan ?? [];
  for (let i = satuan.length - 1; i >= 0; i -= 1) {
    const s = satuan[i];
    if (typeof s.penyebut === "number" && s.penyebut > 0) {
      return {
        nilai: s.cukup ? s.nilai : null,
        terpenuhi: typeof s.terpenuhi === "number" ? s.terpenuhi : null,
        penyebut: s.penyebut,
        sebabTidakCukup: s.cukup ? "" : String(s.sebabTidakCukup || "penyebutnya terlalu kecil untuk dinilai"),
      };
    }
  }
  return { nilai: null, terpenuhi: null, penyebut: null, sebabTidakCukup: "" };
}

export function AletaEAuditLembar() {
  const [katalog, setKatalog] = useState<Katalog | null>(null);
  const [galat, setGalat] = useState("");
  const [babTerpilih, setBabTerpilih] = useState<number>(10);
  const [periode, setPeriode] = useState<string>("tahunan");
  const [acuan, setAcuan] = useState<string>(tanggalHariIni());
  const [lembar, setLembar] = useState<BarisLembar[]>([]);
  const [sedangJalan, setSedangJalan] = useState(false);
  const [terbuka, setTerbuka] = useState("");
  const [buktiTerbuka, setBuktiTerbuka] = useState("");
  const berhentiRef = useRef(false);

  useEffect(() => {
    let dibatalkan = false;
    (async () => {
      try {
        const jawab = await ambilJson<Katalog>("/api/aleta-e-audit/katalog");
        if (dibatalkan) return;
        setKatalog(jawab);
        if (jawab.bab && jawab.bab.length > 0 && !jawab.bab.some((b) => b.no === 10)) {
          setBabTerpilih(jawab.bab[0].no);
        }
      } catch (e) {
        if (!dibatalkan) setGalat(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      dibatalkan = true;
    };
  }, []);

  const butirBab = useMemo(
    () => (katalog?.butir ?? []).filter((b) => b.bab === babTerpilih),
    [katalog, babTerpilih]
  );

  const namaBab = useMemo(
    () => (katalog?.bab ?? []).find((b) => b.no === babTerpilih)?.nama ?? "",
    [katalog, babTerpilih]
  );

  /**
   * Menjalankan seluruh butir bab yang terpilih, berurutan.
   *
   * Butir yang katalognya menyebut "belum" atau "putus" TIDAK dijalankan -
   * tidak ada penilaian untuk dijalankan - tetapi tetap masuk lembar dengan
   * keterangan itu. Lembar audit yang hanya memuat butir yang berhasil akan
   * membuat pembacanya menyangka bab itu sudah terukur seluruhnya.
   */
  const jalankan = useCallback(async () => {
    if (sedangJalan) return;
    berhentiRef.current = false;
    setSedangJalan(true);
    setTerbuka("");

    const awal: BarisLembar[] = butirBab.map((butir) => ({
      butir,
      keadaan: butir.kunci && butir.keadaan !== "belum" && butir.keadaan !== "putus" ? "menunggu" : "dilewati",
      hasil: null,
      sebab:
        butir.keadaan === "belum"
          ? "belum tersambung ke penilaian mana pun - butir ini tidak diukur, dan angkanya tidak ada"
          : butir.keadaan === "putus"
          ? "sambungannya menunjuk penilaian yang tidak terdaftar"
          : "",
    }));
    setLembar(awal);

    for (let i = 0; i < awal.length; i += 1) {
      if (berhentiRef.current) break;
      if (awal[i].keadaan !== "menunggu") continue;
      const kunci = awal[i].butir.kunci as string;

      setLembar((lama) => lama.map((b, j) => (j === i ? { ...b, keadaan: "berjalan" } : b)));

      try {
        const jawab = await ambilJson<HasilPenilaian>(
          `/api/aleta-penilaian/jalankan?kunci=${encodeURIComponent(kunci)}&periode=${encodeURIComponent(
            periode
          )}&acuan=${encodeURIComponent(acuan)}&bukti=25`
        );
        const berhasil = jawab && jawab.ok !== false;
        setLembar((lama) =>
          lama.map((b, j) =>
            j === i
              ? {
                  ...b,
                  keadaan: berhasil ? "selesai" : "gagal",
                  hasil: berhasil ? jawab : null,
                  sebab: berhasil ? "" : String(jawab?.alasan || "penilaian ini tidak dapat dijalankan"),
                }
              : b
          )
        );
      } catch (e) {
        const pesan = e instanceof Error ? e.message : String(e);
        setLembar((lama) =>
          lama.map((b, j) => (j === i ? { ...b, keadaan: "gagal", hasil: null, sebab: pesan } : b))
        );
      }
    }

    setSedangJalan(false);
  }, [acuan, butirBab, periode, sedangJalan]);

  /**
   * Sebaran lembar - BUKAN nilai bab.
   *
   * Lihat kalimat panjang di kepala berkas ini sebelum tergoda menambahkan
   * rerata di sini.
   */
  const sebaran = useMemo(() => {
    let hijau = 0;
    let kuning = 0;
    let merah = 0;
    let takCukup = 0;
    let takDiukur = 0;

    lembar.forEach((b) => {
      if (b.keadaan === "dilewati" || b.keadaan === "gagal") {
        takDiukur += 1;
        return;
      }
      if (b.keadaan !== "selesai") return;
      const n = nilaiTerkini(b.hasil);
      if (n.penyebut === null) {
        takDiukur += 1;
        return;
      }
      if (n.nilai === null) {
        takCukup += 1;
        return;
      }
      const w = warnaNilai(n.nilai);
      if (w === "success") hijau += 1;
      else if (w === "warning") kuning += 1;
      else if (w === "danger") merah += 1;
      else takCukup += 1;
    });

    const selesai = lembar.filter((b) => b.keadaan === "selesai" || b.keadaan === "gagal" || b.keadaan === "dilewati");
    return { hijau, kuning, merah, takCukup, takDiukur, selesai: selesai.length, jumlah: lembar.length };
  }, [lembar]);

  if (galat) {
    return (
      <div className="space-y-6">
        <PageIntro eyebrow="ALETA e-Audit" title="Lembar Audit" />
        <Card>
          <CardContent className="py-6 text-sm text-rose-700 dark:text-rose-300">
            Katalog tidak dapat dibaca: {galat}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="ALETA e-Audit"
        title="Lembar Audit per Bab"
        description="Menjalankan tiap butir satu bab pada satu jendela periode, lalu menyusunnya menjadi satu lembar yang dapat dibaca berurutan - lengkap dengan berkas mana yang perlu dibuka."
      />

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Yang diaudit</CardTitle>
          <CardDescription>
            Butir yang belum tersambung tetap masuk lembar dengan keterangannya. Lembar yang hanya memuat butir
            yang berhasil akan membuat pembacanya menyangka babnya sudah terukur seluruhnya.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Bab</span>
              <NativeSelect
                value={String(babTerpilih)}
                onChange={(e) => setBabTerpilih(Number(e.target.value))}
                disabled={sedangJalan}
              >
                {(katalog?.bab ?? []).map((b) => (
                  <option key={b.no} value={b.no}>
                    {b.no}. {b.nama}
                  </option>
                ))}
              </NativeSelect>
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Jendela periode</span>
              <NativeSelect value={periode} onChange={(e) => setPeriode(e.target.value)} disabled={sedangJalan}>
                {PERIODE.map((p) => (
                  <option key={p.jenis} value={p.jenis}>
                    {p.label}
                  </option>
                ))}
              </NativeSelect>
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Tanggal acuan</span>
              <Input
                type="date"
                value={acuan}
                onChange={(e) => setAcuan(e.target.value)}
                disabled={sedangJalan}
              />
            </label>

            <div className="flex items-end gap-2">
              <Button onClick={jalankan} disabled={sedangJalan || butirBab.length === 0} className="w-full">
                {sedangJalan ? "Sedang berjalan…" : "Jalankan lembar audit"}
              </Button>
              {sedangJalan ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    berhentiRef.current = true;
                  }}
                >
                  Hentikan
                </Button>
              ) : null}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Bab {babTerpilih}
            {namaBab ? ` — ${namaBab}` : ""} memuat {butirBab.length} butir,{" "}
            {butirBab.filter((b) => b.kunci && b.keadaan !== "belum" && b.keadaan !== "putus").length} di antaranya
            tersambung dan akan dijalankan. Tiap butir adalah satu permintaan tersendiri, dan hasilnya muncul
            begitu selesai.
          </p>
        </CardContent>
      </Card>

      {lembar.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Sebaran hasil</CardTitle>
            <CardDescription>
              Sengaja TIDAK ada satu angka untuk seluruh bab. Butir dalam satu bab punya penyebut yang berbeda
              jauh — empat ketua majelis dan sembilan ratus persidangan — sehingga rerata persentasenya memberi
              bobot yang sama kepada keduanya, dan penimbangan menurut penyebut membuat satu butir terbesar
              menelan seluruh bab.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="success">{sebaran.hijau} baik</Badge>
              <Badge variant="warning">{sebaran.kuning} perlu perhatian</Badge>
              <Badge variant="danger">{sebaran.merah} perlu dibuka berkasnya</Badge>
              <Badge variant="muted">{sebaran.takCukup} penyebut terlalu kecil</Badge>
              <Badge variant="outline">{sebaran.takDiukur} tidak diukur</Badge>
              <span className="ml-auto text-xs text-muted-foreground">
                {sebaran.selesai} dari {sebaran.jumlah} butir selesai diproses
              </span>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-3">
        {lembar.map((b) => {
          const n = nilaiTerkini(b.hasil);
          const dibuka = terbuka === b.butir.kode;

          return (
            <Card key={b.butir.kode}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{b.butir.kode}</span>
                      <CardTitle className="text-base">{b.butir.nama}</CardTitle>
                      {b.butir.keadaan === "sebagian" ? <Badge variant="warning">sebagian</Badge> : null}
                    </div>
                    <CardDescription className="max-w-3xl">{b.butir.keterangan}</CardDescription>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {b.keadaan === "berjalan" ? <Badge variant="outline">sedang dihitung…</Badge> : null}
                    {b.keadaan === "menunggu" ? <Badge variant="muted">menunggu giliran</Badge> : null}
                    {b.keadaan === "dilewati" ? <Badge variant="muted">tidak diukur</Badge> : null}
                    {b.keadaan === "gagal" ? <Badge variant="danger">gagal dijalankan</Badge> : null}
                    {b.keadaan === "selesai" && n.penyebut !== null ? (
                      <>
                        {n.nilai === null ? (
                          <Badge variant="muted">belum dapat dinilai</Badge>
                        ) : (
                          <Badge variant={warnaNilai(n.nilai)}>{n.nilai.toFixed(1)}%</Badge>
                        )}
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">
                          {n.terpenuhi ?? "?"}/{n.penyebut}
                        </span>
                      </>
                    ) : null}
                    {b.keadaan === "selesai" || b.keadaan === "gagal" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setTerbuka(dibuka ? "" : b.butir.kode)}
                      >
                        {dibuka ? "Tutup" : "Rinci"}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </CardHeader>

              {b.sebab ? (
                <CardContent className="pt-0">
                  <p className="rounded-xl border border-border/70 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    {b.sebab}
                  </p>
                </CardContent>
              ) : null}

              {b.keadaan === "selesai" && n.nilai === null && n.sebabTidakCukup ? (
                <CardContent className="pt-0">
                  <p className="rounded-xl border border-border/70 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    {n.sebabTidakCukup}
                  </p>
                </CardContent>
              ) : null}

              {dibuka ? (
                <CardContent className="space-y-4 pt-0">
                  {b.butir.catatanSambungan ? (
                    <div className="rounded-xl border border-amber-300/60 bg-amber-50/70 px-3 py-2 text-sm text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/40 dark:text-amber-200">
                      <span className="font-medium">Yang belum terukur: </span>
                      {b.butir.catatanSambungan}
                    </div>
                  ) : null}

                  {b.hasil ? (
                    <HasilPenilaianTampil
                      hasil={b.hasil}
                      buktiTerbuka={buktiTerbuka}
                      setBuktiTerbuka={setBuktiTerbuka}
                    />
                  ) : null}
                </CardContent>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
