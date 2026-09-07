"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  HasilPenilaianTampil,
  type HasilPenilaian,
} from "@/components/portal/penilaian-hasil";
import { apiPath } from "@/lib/base-path";

/**
 * ============================================================================
 * ALETA e-AUDIT - TAHAP 1
 * ============================================================================
 *
 * Kerangka aplikasi beserta katalog seratus delapan puluh lima butir.
 *
 * Yang penting pada tahap ini bukan keindahannya, melainkan satu sifat:
 * butir yang BELUM dikerjakan tetap tampil. Menyembunyikannya membuat aplikasi
 * terlihat selesai padahal baru sebagian, dan orang yang membukanya menyangka
 * ALETA memang tidak menilai hal itu.
 *
 * Karena itu tiap butir membawa keadaannya sendiri - tersambung penuh,
 * tersambung sebagian, atau belum sama sekali - dan keadaan itu DIHITUNG di
 * sisi mesin dari selisih antara katalog dan penilaian yang benar-benar
 * terdaftar. Tidak ada satu pun angka kemajuan yang ditulis tangan di sini.
 *
 * ============================================================================
 * "SEBAGIAN" TIDAK BOLEH TERBACA SEPERTI "SUDAH"
 * ============================================================================
 *
 * Enam penilaian yang sudah dibangun mengukur hal yang mirip dengan butir
 * katalognya, tetapi hanya dua yang benar-benar sama. Sisanya lebih sempit -
 * misalnya memeriksa keberadaan berita acara, sedangkan butirnya menuntut
 * jarak waktu penyelesaiannya.
 *
 * Butir seperti itu ditandai "sebagian" dan membawa catatan yang menyebutkan
 * apa yang masih kurang. Catatan itu tampil pada halaman butirnya, bukan
 * disimpan di dalam kode.
 */

type ApiEnvelope<T> = { ok?: boolean; data?: T; error?: { message?: string } };

type Bab = { no: number; nama: string; jumlah: number };

type KeadaanButir = "penuh" | "sebagian" | "belum" | "putus";

type Butir = {
  kode: string;
  bab: number;
  nama: string;
  bentuk: string;
  satuanBaris: string;
  mutuRuas: "kode" | "hitung" | "bebas";
  lantai: string;
  keterangan: string;
  keadaan: KeadaanButir;
  kunci: string | null;
  catatanSambungan: string;
};

type Ringkas = {
  jumlahButir: number;
  penuh: number;
  sebagian: number;
  belum: number;
  putus: number;
  diLuarKatalog: number;
  tanpaTempat: string[];
};

type Katalog = {
  available?: boolean;
  ok?: boolean;
  alasan?: string;
  bab?: Bab[];
  bentuk?: Record<string, string>;
  mutuRuas?: Record<string, string>;
  butir?: Butir[];
  ringkas?: Ringkas;
  diLuarKatalog?: Record<string, string>;
  cela?: string[];
  catatan?: string;
};

type CaraHitung = {
  pembilang?: string;
  penyebut?: string;
  dikecualikan?: string;
  tabelSumber?: string;
  ruasSumber?: string;
};

type Rinci = {
  available?: boolean;
  ok?: boolean;
  alasan?: string;
  butir?: Butir & {
    bentukTerbaca?: Array<{ huruf: string; arti: string | null }>;
    artiMutuRuas?: string | null;
  };
  keadaan?: KeadaanButir;
  kunci?: string | null;
  catatanSambungan?: string;
  definisi?: {
    judul?: string;
    keterangan?: string;
    lantai?: string;
    versiRumus?: string;
    caraHitung?: CaraHitung;
    ambangDipakai?: string[];
    pakaiHariKerja?: boolean;
  } | null;
  bab?: Bab | null;
};

const LENCANA: Record<KeadaanButir, { teks: string; variant: "success" | "warning" | "muted" | "danger" }> = {
  penuh: { teks: "tersambung", variant: "success" },
  sebagian: { teks: "sebagian", variant: "warning" },
  belum: { teks: "belum", variant: "muted" },
  putus: { teks: "sambungan putus", variant: "danger" },
};

const LENCANA_MUTU: Record<string, "success" | "default" | "danger"> = {
  kode: "success",
  hitung: "default",
  bebas: "danger",
};

async function ambilJson<T>(alamat: string): Promise<T> {
  const respons = await fetch(apiPath(alamat), { cache: "no-store" });
  const isi = (await respons.json()) as ApiEnvelope<T>;
  return (isi.data ?? (isi as unknown)) as T;
}

export function AletaEAudit() {
  const [katalog, setKatalog] = useState<Katalog | null>(null);
  const [galat, setGalat] = useState("");
  const [babTerpilih, setBabTerpilih] = useState<number>(0);
  const [cari, setCari] = useState("");
  const [kodeTerbuka, setKodeTerbuka] = useState("");
  const [rinci, setRinci] = useState<Rinci | null>(null);
  const [sedangBuka, setSedangBuka] = useState("");

  useEffect(() => {
    let dibatalkan = false;
    (async () => {
      try {
        const jawab = await ambilJson<Katalog>("/api/aleta-e-audit/katalog");
        if (dibatalkan) return;
        setKatalog(jawab);
        if (jawab.bab && jawab.bab.length > 0) setBabTerpilih(jawab.bab[0].no);
      } catch (e) {
        if (!dibatalkan) setGalat(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      dibatalkan = true;
    };
  }, []);

  const bukaButir = useCallback(async (kode: string) => {
    setKodeTerbuka(kode);
    setSedangBuka(kode);
    setRinci(null);
    try {
      const jawab = await ambilJson<Rinci>(`/api/aleta-e-audit/butir?kode=${encodeURIComponent(kode)}`);
      setRinci(jawab);
    } catch (e) {
      setRinci({ ok: false, alasan: e instanceof Error ? e.message : String(e) });
    } finally {
      setSedangBuka("");
    }
  }, []);

  const semua = useMemo(() => katalog?.butir || [], [katalog]);

  // Pencarian menyapu SELURUH katalog, bukan hanya bab yang sedang terbuka.
  // Orang yang mencari sebuah butir jarang tahu bab mana yang memuatnya.
  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    if (q) {
      return semua.filter(
        (b) =>
          b.kode.toLowerCase().includes(q) ||
          b.nama.toLowerCase().includes(q) ||
          b.keterangan.toLowerCase().includes(q)
      );
    }
    return semua.filter((b) => b.bab === babTerpilih);
  }, [cari, semua, babTerpilih]);

  const r = katalog?.ringkas;

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="ALETA e-Audit"
        title="Pengawasan Berjenjang"
        description="Ketaatan tahapan, mutu data, laporan perkara, keuangan, dan kinerja aparatur - dengan bukti yang selalu dapat dibuka sampai ke nomor perkaranya."
      />

      {galat ? (
        <div className="rounded-md border border-rose-300/70 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-700/50 dark:bg-rose-950/40 dark:text-rose-300">
          Katalog tidak dapat diambil: {galat}
        </div>
      ) : null}

      {katalog && katalog.available === false ? (
        <div className="rounded-md border border-amber-300/70 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200">
          {katalog.alasan || "ALETA Bot belum dapat dihubungi."}
        </div>
      ) : null}

      {r ? <PitaKemajuan ringkas={r} cela={katalog?.cela || []} /> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
        <DaftarBab
          bab={katalog?.bab || []}
          butir={semua}
          terpilih={babTerpilih}
          onPilih={(no) => {
            setBabTerpilih(no);
            setCari("");
          }}
        />

        <div className="space-y-4">
          <Card className="border-border/80">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">
                    {cari.trim()
                      ? `Hasil pencarian "${cari.trim()}"`
                      : katalog?.bab?.find((b) => b.no === babTerpilih)?.nama || "Butir penilaian"}
                  </CardTitle>
                  <CardDescription>
                    {tersaring.length} butir
                    {cari.trim() ? " dari seluruh dua belas bab" : ""}
                  </CardDescription>
                </div>
                <Input
                  className="h-9 w-full sm:w-72"
                  placeholder="Cari kode, nama, atau keterangan..."
                  value={cari}
                  onChange={(e) => setCari(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {tersaring.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Tidak ada butir yang cocok.
                </p>
              ) : (
                tersaring.map((b) => (
                  <BarisButir
                    key={b.kode}
                    butir={b}
                    terbuka={kodeTerbuka === b.kode}
                    sedang={sedangBuka === b.kode}
                    onBuka={() => (kodeTerbuka === b.kode ? setKodeTerbuka("") : void bukaButir(b.kode))}
                  />
                ))
              )}
            </CardContent>
          </Card>

          {kodeTerbuka && rinci ? <PanelButir rinci={rinci} /> : null}
        </div>
      </div>

      {katalog?.catatan ? (
        <p className="text-xs leading-5 text-muted-foreground">{katalog.catatan}</p>
      ) : null}
    </div>
  );
}

/**
 * Kemajuan yang dihitung, bukan ditulis.
 *
 * Tiga keadaan yang mudah tersembunyi ikut ditampilkan di sini: sambungan yang
 * putus, penilaian yang berjalan tanpa tercatat di katalog, dan cela pada
 * katalog itu sendiri. Ketiganya tidak akan pernah muncul pada keadaan sehat,
 * dan justru karena itu harus terlihat begitu muncul.
 */
function PitaKemajuan({ ringkas, cela }: { ringkas: Ringkas; cela: string[] }) {
  const bermasalah = ringkas.putus > 0 || ringkas.tanpaTempat.length > 0 || cela.length > 0;
  const persen = ringkas.jumlahButir
    ? ((ringkas.penuh / ringkas.jumlahButir) * 100).toFixed(1)
    : "0";

  return (
    <Card className="border-border/80">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Kemajuan katalog</CardTitle>
            <CardDescription>
              Dihitung dari selisih antara katalog dan penilaian yang benar-benar terdaftar di
              mesin - bukan disimpan, sehingga tidak mungkin usang.
            </CardDescription>
          </div>
          <Badge variant="muted">{persen}% tersambung penuh</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Angka label="Butir katalog" nilai={ringkas.jumlahButir} />
          <Angka label="Tersambung penuh" nilai={ringkas.penuh} warna="text-emerald-700 dark:text-emerald-300" />
          <Angka label="Tersambung sebagian" nilai={ringkas.sebagian} warna="text-amber-700 dark:text-amber-300" />
          <Angka label="Belum tersambung" nilai={ringkas.belum} warna="text-muted-foreground" />
        </div>

        {ringkas.diLuarKatalog > 0 ? (
          <p className="text-xs leading-5 text-muted-foreground">
            Ditambah {ringkas.diLuarKatalog} penilaian yang sudah berjalan tetapi tidak punya butir
            di katalog. Keduanya dicatat beserta alasannya, bukan dibiarkan tanpa tempat.
          </p>
        ) : null}

        {bermasalah ? (
          <div className="rounded-md border border-rose-300/70 bg-rose-50 p-3 text-sm leading-6 text-rose-800 dark:border-rose-700/50 dark:bg-rose-950/40 dark:text-rose-300">
            <p className="font-semibold">Perlu diperiksa</p>
            {ringkas.putus > 0 ? (
              <p>
                {ringkas.putus} butir disambungkan ke penilaian yang tidak terdaftar di mesin.
              </p>
            ) : null}
            {ringkas.tanpaTempat.length > 0 ? (
              <p>
                Penilaian berjalan tanpa tercatat di katalog: {ringkas.tanpaTempat.join(", ")}.
              </p>
            ) : null}
            {cela.length > 0 ? <p>Cela pada katalog: {cela.join("; ")}</p> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Angka({ label, nilai, warna }: { label: string; nilai: number; warna?: string }) {
  return (
    <div className="rounded-lg border border-border/80 bg-muted/30 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${warna || ""}`}>{nilai}</p>
    </div>
  );
}

function DaftarBab({
  bab,
  butir,
  terpilih,
  onPilih,
}: {
  bab: Bab[];
  butir: Butir[];
  terpilih: number;
  onPilih: (no: number) => void;
}) {
  return (
    <Card className="border-border/80 lg:sticky lg:top-4 lg:self-start">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Dua belas bab</CardTitle>
        <CardDescription>{butir.length} butir seluruhnya</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {bab.map((b) => {
          const isi = butir.filter((x) => x.bab === b.no);
          const jadi = isi.filter((x) => x.keadaan === "penuh").length;
          const sebagian = isi.filter((x) => x.keadaan === "sebagian").length;
          const aktif = b.no === terpilih;
          return (
            <button
              key={b.no}
              type="button"
              onClick={() => onPilih(b.no)}
              className={`flex w-full items-start justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
                aktif
                  ? "border-primary/40 bg-primary/10"
                  : "border-transparent hover:border-border/80 hover:bg-muted/50"
              }`}
            >
              <span>
                <span className="text-xs text-muted-foreground">Bab {b.no}</span>
                <span className="block font-medium leading-5">{b.nama}</span>
              </span>
              <span className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                {jadi + sebagian > 0 ? (
                  <span className="text-emerald-700 dark:text-emerald-300">{jadi + sebagian}</span>
                ) : null}
                {jadi + sebagian > 0 ? " / " : ""}
                {b.jumlah}
              </span>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

function BarisButir({
  butir,
  terbuka,
  sedang,
  onBuka,
}: {
  butir: Butir;
  terbuka: boolean;
  sedang: boolean;
  onBuka: () => void;
}) {
  const l = LENCANA[butir.keadaan] || LENCANA.belum;
  return (
    <button
      type="button"
      onClick={onBuka}
      className={`flex w-full flex-wrap items-start justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
        terbuka ? "border-primary/40 bg-primary/5" : "border-border/80 hover:bg-muted/40"
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">{butir.kode}</code>
          <span className="font-medium">{butir.nama}</span>
        </span>
        <span className="mt-0.5 block text-sm leading-6 text-muted-foreground">
          {butir.keterangan}
        </span>
      </span>
      <span className="flex shrink-0 flex-wrap items-center gap-1.5">
        <Badge variant={LENCANA_MUTU[butir.mutuRuas] || "outline"}>{butir.mutuRuas}</Badge>
        <Badge variant={l.variant}>{sedang ? "..." : l.teks}</Badge>
      </span>
    </button>
  );
}

/** Ketujuh jendela periode, sama dengan yang dikenal mesin. */
const PERIODE = [
  ["harian", "Harian"],
  ["mingguan", "Mingguan"],
  ["bulanan", "Bulanan"],
  ["triwulan", "Triwulan"],
  ["semester", "Semester"],
  ["tahunan", "Tahunan"],
  ["keseluruhan", "Keseluruhan"],
] as const;

/**
 * Menjalankan penilaian sebuah butir.
 *
 * ============================================================================
 * MEMANGGIL RUTE YANG SAMA, BUKAN RUTE KEDUA
 * ============================================================================
 *
 * e-Audit tidak punya mesin penilaiannya sendiri. Ia memanggil rute yang sudah
 * dipakai layar Penilaian Berjenjang, dan menggambar hasilnya dengan komponen
 * yang sama pula.
 *
 * Membuat rute kedua yang "khusus e-Audit" akan menghasilkan dua jalur hitung
 * untuk angka yang sama. Keduanya akan bekerja, dan pada suatu hari keduanya
 * akan menjawab berbeda - tanpa ada yang tahu mana yang benar.
 */
function JalankanButir({ kunci }: { kunci: string }) {
  const [periode, setPeriode] = useState("bulanan");
  const [hasil, setHasil] = useState<HasilPenilaian | null>(null);
  const [sedang, setSedang] = useState(false);
  const [buktiTerbuka, setBuktiTerbuka] = useState("");

  const jalankan = useCallback(async () => {
    setSedang(true);
    setBuktiTerbuka("");
    try {
      const kueri = new URLSearchParams({ kunci, periode, bukti: "25" });
      setHasil(await ambilJson<HasilPenilaian>(`/api/aleta-penilaian/jalankan?${kueri.toString()}`));
    } catch (e) {
      setHasil({ ok: false, alasan: e instanceof Error ? e.message : String(e) });
    } finally {
      setSedang(false);
    }
  }, [kunci, periode]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor={`periode-${kunci}`}>
            Jendela periode
          </label>
          <select
            id={`periode-${kunci}`}
            className="h-9 rounded-lg border border-input/90 bg-card/70 px-3 text-sm dark:bg-background/40"
            value={periode}
            onChange={(e) => setPeriode(e.target.value)}
          >
            {PERIODE.map(([nilai, label]) => (
              <option key={nilai} value={nilai}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={() => void jalankan()} disabled={sedang}>
          {sedang ? "Menghitung..." : "Hitung"}
        </Button>
      </div>

      {hasil ? (
        <HasilPenilaianTampil
          hasil={hasil}
          buktiTerbuka={buktiTerbuka}
          setBuktiTerbuka={setBuktiTerbuka}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Belum dihitung. Tidak ada yang dijalankan sebelum tombolnya ditekan - sebagian penilaian
          membaca seluruh register.
        </p>
      )}
    </div>
  );
}

function PanelButir({ rinci }: { rinci: Rinci }) {
  if (rinci.ok === false) {
    return (
      <Card className="border-rose-300/70">
        <CardContent className="pt-6 text-sm text-rose-800 dark:text-rose-300">
          {rinci.alasan || "Butir tidak dapat dibuka."}
        </CardContent>
      </Card>
    );
  }

  const b = rinci.butir;
  if (!b) return null;
  const l = LENCANA[rinci.keadaan || "belum"] || LENCANA.belum;

  return (
    <Card className="border-border/80">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">
              <code className="mr-2 rounded bg-muted px-1.5 py-0.5 text-sm">{b.kode}</code>
              {b.nama}
            </CardTitle>
            <CardDescription>
              Bab {b.bab}
              {rinci.bab ? ` - ${rinci.bab.nama}` : ""}
            </CardDescription>
          </div>
          <Badge variant={l.variant}>{l.teks}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-6">{b.keterangan}</p>

        {rinci.keadaan === "sebagian" && rinci.catatanSambungan ? (
          <div className="rounded-md border border-amber-300/70 bg-amber-50 p-3 text-sm leading-6 text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200">
            <strong>Baru tersambung sebagian.</strong> {rinci.catatanSambungan}
          </div>
        ) : null}

        {rinci.keadaan === "belum" ? (
          <div className="rounded-md border border-border/80 bg-muted/40 p-3 text-sm leading-6">
            Butir ini <strong>belum tersambung</strong> ke penilaian mana pun. Ia tetap ditampilkan
            supaya sisa pekerjaan terlihat - bukan disembunyikan sampai selesai.
          </div>
        ) : null}

        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <Ruas label="Satuan baris bukti" isi={b.satuanBaris || "-"} />
          <Ruas label="Lantai periode" isi={b.lantai} />
          <Ruas
            label="Bentuk sajian"
            isi={(b.bentukTerbaca || []).map((x) => x.arti || x.huruf).join(", ") || b.bentuk}
          />
          <Ruas label="Sumber angka" isi={b.artiMutuRuas || b.mutuRuas} />
        </dl>

        {rinci.kunci ? (
          <div className="rounded-lg border border-border/80 p-3">
            <p className="mb-2 text-sm font-semibold">Jalankan penilaian ini</p>
            <JalankanButir kunci={rinci.kunci} />
          </div>
        ) : null}

        {rinci.definisi ? (
          <div className="rounded-lg border border-border/80 bg-muted/30 p-3">
            <p className="mb-2 text-sm font-semibold">
              Cara hitung yang benar-benar dipakai
              {rinci.definisi.versiRumus ? (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  rumus {rinci.definisi.versiRumus}
                </span>
              ) : null}
            </p>
            <dl className="grid gap-2 text-sm md:grid-cols-2">
              <Ruas label="Yang dihitung memenuhi" isi={rinci.definisi.caraHitung?.pembilang || "-"} />
              <Ruas label="Pembaginya" isi={rinci.definisi.caraHitung?.penyebut || "-"} />
              <Ruas label="Yang dikecualikan" isi={rinci.definisi.caraHitung?.dikecualikan || "-"} />
              <Ruas label="Tabel SIPP yang dibaca" isi={rinci.definisi.caraHitung?.tabelSumber || "-"} />
              <Ruas label="Ruas yang dibaca" isi={rinci.definisi.caraHitung?.ruasSumber || "-"} />
              {rinci.definisi.pakaiHariKerja ? (
                <Ruas label="Catatan" isi="Menghitung hari kerja, sehingga bergantung pada daftar hari libur nasional." />
              ) : null}
            </dl>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Ruas({ label, isi }: { label: string; isi: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="leading-6">{isi}</dd>
    </div>
  );
}
