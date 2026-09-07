"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { apiPath } from "@/lib/base-path";

/**
 * ============================================================================
 * PENILAIAN BERJENJANG - LAYAR YANG MENOLAK MENAMPILKAN ANGKA YANG TIDAK PANTAS
 * ============================================================================
 *
 * Delapan penilaian sudah dapat dihitung dan lulus uji. Sampai layar ini ada,
 * tidak seorang pun di pengadilan dapat MELIHATnya - dan kode yang lulus uji
 * tetapi tidak dapat dilihat siapa pun bukan pekerjaan yang selesai.
 *
 * Layar ini bukan penghias hasil. Tugasnya justru sebaliknya: menahan angka
 * yang belum pantas ditampilkan sebagai nilai, dan menyebut sebabnya. Ada empat
 * keadaan yang membuat nilai TIDAK ditampilkan, dan seluruhnya datang dari
 * mesinnya - bukan diputuskan di sini:
 *
 *   1. `bawahLantai`  - periodenya lebih pendek daripada lantai penilaian itu.
 *                       Ketaatan tenggang pemanggilan tidak bermakna sebagai
 *                       persentase harian; yang disajikan daftar kerjanya.
 *   2. `cukup: false` - penyebutnya di bawah dua puluh. Tiga dari tiga adalah
 *                       seratus persen, dan seratus persen dari tiga tidak
 *                       memberi tahu apa pun.
 *   3. `selisihRingkas` - kueri agregat dan daftar buktinya tidak sepakat.
 *                       Itu temuan, bukan hal yang boleh dibulatkan.
 *   4. penyandingan belum dikerjakan - angkanya belum pernah dibandingkan
 *                       dengan angka dari luar ALETA.
 *
 * Yang keempat tidak menghilangkan angkanya, tetapi menempel padanya sampai
 * seseorang benar-benar menyandingkan.
 *
 * ============================================================================
 * BUKTINYA IKUT, DAN ITU YANG MEMBEDAKANNYA DARI PAPAN ANGKA
 * ============================================================================
 *
 * Tiap satuan periode membawa daftar barisnya. Angka pembilang dan penyebutnya
 * DITURUNKAN dari daftar itu, sehingga keduanya tidak mungkin berbeda. Orang
 * yang tidak percaya pada angkanya dapat membuka daftarnya, mengambil satu
 * nomor perkara, lalu memeriksanya sendiri di SIPP.
 *
 * Kolom daftarnya tidak ditulis di sini. Tiap penilaian membawa ruasnya
 * sendiri - tenggang pemanggilan membawa juru sita dan tanggal relaas,
 * kelengkapan berita acara membawa panitera sidang - dan menuliskannya di layar
 * berarti daftar kedua yang perlahan menyimpang. Kolomnya disusun dari ruas
 * yang benar-benar ada pada barisnya.
 */

type ApiEnvelope<T> = { ok?: boolean; data?: T; error?: { message?: string } };

type CaraHitung = {
  pembilang?: string;
  penyebut?: string;
  dikecualikan?: string;
  tabelSumber?: string;
  ruasSumber?: string;
};

type PenilaianRingkas = {
  kunci: string;
  judul: string;
  keterangan?: string;
  lantai?: string;
  versiRumus?: string;
  ambangDipakai?: string[];
  caraHitung?: CaraHitung;
  punyaRingkas?: boolean;
};

type JendelaPeriode = { jenis: string; label: string; satuan?: string };

type DaftarJawaban = {
  available?: boolean;
  ok?: boolean;
  alasan?: string;
  jumlah?: number;
  penilaian?: PenilaianRingkas[];
  periode?: JendelaPeriode[];
  catatan?: string;
};

type BarisBukti = Record<string, unknown>;

type SatuanHasil = {
  unit: { kunci: string; label?: string; mulai: string; selesai: string };
  nilai: number | null;
  cukup: boolean;
  sebabTidakCukup?: string;
  terpenuhi?: number;
  penyebut?: number;
  batasPenyebut?: number;
  jumlahBukti?: number;
  belumMemenuhi?: number;
  buktiDipotong?: boolean;
  bukti?: BarisBukti[];
  selisihRingkas?: {
    dariBaris: { terpenuhi: number; penyebut: number };
    dariRingkas: { terpenuhi: number; penyebut: number };
    arti: string;
  } | null;
};

type AmbangDipakai = {
  kunci?: string;
  nilai: number | null;
  satuan?: string;
  dasar?: string;
  sifat?: string;
  sebab?: string;
  mulai?: string;
};

type HasilPenilaian = {
  available?: boolean;
  ok?: boolean;
  alasan?: string;
  kunci?: string;
  judul?: string;
  keterangan?: string;
  lantai?: string;
  versiRumus?: string;
  acuan?: string;
  periode?: { jenis: string; label: string; satuan: string; banyak: number };
  bawahLantai?: boolean;
  satuan?: SatuanHasil[];
  ambangDipakai?: AmbangDipakai[];
  caraHitung?: CaraHitung;
  penyandingan?: { keadaan?: string; penanda?: string };
  pakaiHariKerja?: boolean;
  hariLibur?: {
    dapatDipercaya: boolean;
    tahunBelumDisahkan?: number[];
    tahunTanpaDaftar?: number[];
    sebab?: string | null;
  } | null;
};

type ButirLipa = { nomor: number; kunci: string; nama: string; dipa04: boolean };

type BarisBlangko = {
  bulanLaporan: string;
  batasKirim: string | null;
  tanggalKirim: string | null;
  terlambatHari: number | null;
  angkaLaporan: number | null;
  angkaSipp: number | null;
  selisihAngka: number | null;
  nilai: number | null;
  keadaan?: string;
  nilaiKetepatan?: number | null;
  nilaiKesesuaian?: number | null;
  belumDapatDinilai?: string | null;
};

type Blangko = {
  available?: boolean;
  ok?: boolean;
  alasan?: string;
  lipa?: string;
  nomor?: number;
  nama?: string;
  dipa04?: boolean;
  kolom?: string[];
  baris?: BarisBlangko[];
  catatan?: string;
};

/** Ruas yang tidak perlu menjadi kolom - sudah tampil sebagai judul baris. */
const RUAS_BUKAN_KOLOM = new Set(["kunci"]);

const LABEL_KOLOM: Record<string, string> = {
  bulanLaporan: "Bulan",
  batasKirim: "Batas Kirim",
  tanggalKirim: "Dikirim",
  terlambatHari: "Telat (hari)",
  angkaLaporan: "Angka Laporan",
  angkaSipp: "Angka SIPP",
  selisihAngka: "Selisih",
  nilai: "Nilai",
  keadaan: "Keadaan",
};

function judulRuas(ruas: string) {
  if (LABEL_KOLOM[ruas]) return LABEL_KOLOM[ruas];
  const dipisah = ruas.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return dipisah.charAt(0).toUpperCase() + dipisah.slice(1);
}

function tampilkan(nilai: unknown): string {
  if (nilai === null || nilai === undefined || nilai === "") return "-";
  if (typeof nilai === "boolean") return nilai ? "ya" : "tidak";
  if (typeof nilai === "number") return Number.isInteger(nilai) ? String(nilai) : nilai.toFixed(2);
  return String(nilai);
}

/**
 * Warna nilai. Ambangnya sengaja longgar dan hanya tiga tingkat - warna di sini
 * membantu mata, bukan menetapkan predikat. Predikat ditetapkan manusia.
 */
function warnaNilai(nilai: number | null): "success" | "warning" | "danger" | "muted" {
  if (nilai === null) return "muted";
  if (nilai >= 90) return "success";
  if (nilai >= 75) return "warning";
  return "danger";
}

async function ambilJson<T>(alamat: string, opsi?: RequestInit): Promise<T> {
  const respons = await fetch(apiPath(alamat), { cache: "no-store", ...opsi });
  const isi = (await respons.json()) as ApiEnvelope<T>;
  return (isi.data ?? (isi as unknown)) as T;
}

export function AletaPenilaianBerjenjang() {
  const [daftar, setDaftar] = useState<DaftarJawaban | null>(null);
  const [galatDaftar, setGalatDaftar] = useState("");
  const [kunci, setKunci] = useState("");
  const [periode, setPeriode] = useState("bulanan");
  const [acuan, setAcuan] = useState("");
  const [hasil, setHasil] = useState<HasilPenilaian | null>(null);
  const [sedangHitung, setSedangHitung] = useState(false);
  const [buktiTerbuka, setBuktiTerbuka] = useState<string>("");

  useEffect(() => {
    let dibatalkan = false;
    (async () => {
      try {
        const jawab = await ambilJson<DaftarJawaban>("/api/aleta-penilaian/daftar");
        if (dibatalkan) return;
        setDaftar(jawab);
        if (jawab.penilaian && jawab.penilaian.length > 0) setKunci(jawab.penilaian[0].kunci);
      } catch (galat) {
        if (!dibatalkan) setGalatDaftar(galat instanceof Error ? galat.message : String(galat));
      }
    })();
    return () => {
      dibatalkan = true;
    };
  }, []);

  const terpilih = useMemo(
    () => (daftar?.penilaian || []).find((p) => p.kunci === kunci) || null,
    [daftar, kunci]
  );

  const jalankan = useCallback(async () => {
    if (!kunci) return;
    setSedangHitung(true);
    setBuktiTerbuka("");
    try {
      const kueri = new URLSearchParams({ kunci, periode, bukti: "25" });
      if (acuan) kueri.set("acuan", acuan);
      const jawab = await ambilJson<HasilPenilaian>(`/api/aleta-penilaian/jalankan?${kueri.toString()}`);
      setHasil(jawab);
    } catch (galat) {
      setHasil({ ok: false, alasan: galat instanceof Error ? galat.message : String(galat) });
    } finally {
      setSedangHitung(false);
    }
  }, [acuan, kunci, periode]);

  const jendela = daftar?.periode || [];

  return (
    <div className="space-y-4">
      <Card className="border-border/80">
        <CardHeader>
          <CardTitle>Penilaian Berjenjang</CardTitle>
          <CardDescription>
            Delapan penilaian yang angkanya diturunkan dari daftar buktinya, sehingga angka dan bukti
            tidak mungkin berbeda. Tidak satu pun boleh dipakai membina sebelum disandingkan dengan
            angka dari luar ALETA.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {galatDaftar ? (
            <div className="rounded-md border border-rose-300/70 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-700/50 dark:bg-rose-950/40 dark:text-rose-300">
              Daftar penilaian tidak dapat diambil: {galatDaftar}
            </div>
          ) : null}

          {daftar && daftar.available === false ? (
            <div className="rounded-md border border-amber-300/70 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200">
              {daftar.alasan || "ALETA Bot belum dapat dihubungi."}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="penilaian-kunci">
                Penilaian
              </label>
              <NativeSelect
                id="penilaian-kunci"
                value={kunci}
                onChange={(e) => setKunci(e.target.value)}
                disabled={!daftar?.penilaian?.length}
              >
                {(daftar?.penilaian || []).map((p) => (
                  <option key={p.kunci} value={p.kunci}>
                    {p.judul}
                  </option>
                ))}
                {daftar?.penilaian?.length ? null : <option value="">(belum ada)</option>}
              </NativeSelect>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="penilaian-periode">
                Jendela periode
              </label>
              <NativeSelect
                id="penilaian-periode"
                value={periode}
                onChange={(e) => setPeriode(e.target.value)}
              >
                {(jendela.length
                  ? jendela
                  : [{ jenis: "bulanan", label: "Bulanan" }]
                ).map((j) => (
                  <option key={j.jenis} value={j.jenis}>
                    {j.label}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="penilaian-acuan">
                Tanggal acuan
              </label>
              <Input
                id="penilaian-acuan"
                type="date"
                value={acuan}
                onChange={(e) => setAcuan(e.target.value)}
              />
            </div>

            <div className="flex items-end">
              <Button onClick={jalankan} disabled={!kunci || sedangHitung}>
                {sedangHitung ? "Menghitung..." : "Hitung"}
              </Button>
            </div>
          </div>

          {terpilih ? (
            <div className="rounded-md border border-border/80 bg-muted/40 p-3 text-sm">
              <p className="text-muted-foreground">{terpilih.keterangan}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {terpilih.lantai ? <Badge variant="outline">lantai {terpilih.lantai}</Badge> : null}
                {terpilih.versiRumus ? (
                  <Badge variant="muted">rumus {terpilih.versiRumus}</Badge>
                ) : null}
                {terpilih.punyaRingkas ? (
                  <Badge variant="muted">punya kueri agregat pembanding</Badge>
                ) : null}
              </div>
            </div>
          ) : null}

          {daftar?.catatan ? (
            <p className="text-xs leading-5 text-muted-foreground">{daftar.catatan}</p>
          ) : null}
        </CardContent>
      </Card>

      {hasil ? (
        <HasilPenilaianTampil
          hasil={hasil}
          buktiTerbuka={buktiTerbuka}
          setBuktiTerbuka={setBuktiTerbuka}
        />
      ) : null}

      <PencatatanLaporanPerkara />
    </div>
  );
}

function HasilPenilaianTampil({
  hasil,
  buktiTerbuka,
  setBuktiTerbuka,
}: {
  hasil: HasilPenilaian;
  buktiTerbuka: string;
  setBuktiTerbuka: (kunci: string) => void;
}) {
  if (hasil.ok === false) {
    return (
      <Card className="border-rose-300/70">
        <CardContent className="pt-6 text-sm text-rose-800 dark:text-rose-300">
          {hasil.alasan || "Penilaian tidak dapat dijalankan."}
        </CardContent>
      </Card>
    );
  }

  const keadaanSanding = hasil.penyandingan?.keadaan || "belum";
  const sudahDisanding = keadaanSanding === "sudah" || keadaanSanding === "cocok";

  return (
    <Card className="border-border/80">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{hasil.judul}</CardTitle>
            <CardDescription>
              {hasil.periode?.label} - {hasil.periode?.banyak} {hasil.periode?.satuan} sampai{" "}
              {hasil.acuan}
            </CardDescription>
          </div>
          <Badge variant={sudahDisanding ? "success" : "warning"}>
            {sudahDisanding ? "sudah disandingkan" : "belum disandingkan"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ==================================================================
            PENYANDINGAN - PERINGATAN YANG TIDAK BOLEH HILANG
            ==================================================================
            Angka yang belum pernah dibandingkan dengan angka dari luar ALETA
            belum boleh dipakai membina siapa pun. Peringatan ini menempel pada
            hasilnya, bukan disembunyikan di catatan kaki. */}
        {sudahDisanding ? null : (
          <div className="rounded-md border border-amber-300/70 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200">
            Angka ini belum pernah disandingkan dengan angka dari luar ALETA. Boleh dibaca dan
            diperiksa, belum boleh dipakai membina.
            {hasil.penyandingan?.penanda ? ` ${hasil.penyandingan.penanda}` : ""}
          </div>
        )}

        {/* ==================================================================
            DAFTAR HARI LIBUR - DASAR YANG BELUM DIPASTIKAN
            ==================================================================
            Hanya penilaian yang benar-benar menghitung hari kerja yang membawa
            pita ini. Menghitung tenggang tiga hari kerja dengan daftar libur
            yang belum disahkan berarti menuduh juru sita memakai dasar yang
            belum dipastikan sendiri. */}
        {hasil.pakaiHariKerja && hasil.hariLibur && !hasil.hariLibur.dapatDipercaya ? (
          <div className="rounded-md border border-amber-300/70 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200">
            Penilaian ini menghitung <strong>hari kerja</strong>, dan{" "}
            {hasil.hariLibur.sebab || "daftar hari liburnya belum disahkan"}. Angkanya boleh dibaca,
            belum boleh dipakai membina. Yang perlu dikerjakan: mencocokkan tanggalnya dengan SKB
            tiga menteri, lalu menandai tahun itu sudah disahkan.
          </div>
        ) : null}

        {hasil.bawahLantai ? (
          <div className="rounded-md border border-border/80 bg-muted/50 p-3 text-sm">
            Penilaian ini berlantai <strong>{hasil.lantai}</strong>. Pada jendela sependek ini yang
            disajikan daftar kerjanya, bukan nilai - persentase dari beberapa baris tidak memberi
            tahu apa pun.
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(hasil.satuan || []).map((s) => (
            <SatuanKartu
              key={s.unit.kunci}
              satuan={s}
              terbuka={buktiTerbuka === s.unit.kunci}
              onBuka={() => setBuktiTerbuka(buktiTerbuka === s.unit.kunci ? "" : s.unit.kunci)}
            />
          ))}
        </div>

        {(hasil.satuan || []).map((s) =>
          buktiTerbuka === s.unit.kunci ? (
            <TabelBukti key={`bukti-${s.unit.kunci}`} satuan={s} />
          ) : null
        )}

        <PanelCaraHitung caraHitung={hasil.caraHitung} ambang={hasil.ambangDipakai} />
      </CardContent>
    </Card>
  );
}

function SatuanKartu({
  satuan,
  terbuka,
  onBuka,
}: {
  satuan: SatuanHasil;
  terbuka: boolean;
  onBuka: () => void;
}) {
  const jumlahBukti =
    satuan.jumlahBukti !== undefined ? satuan.jumlahBukti : (satuan.bukti || []).length;

  return (
    <div className="rounded-lg border border-border/80 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{satuan.unit.label || satuan.unit.kunci}</p>
          <p className="text-xs text-muted-foreground">
            {satuan.unit.mulai} s.d. {satuan.unit.selesai}
          </p>
        </div>
        {satuan.nilai === null ? (
          <Badge variant="muted">tanpa nilai</Badge>
        ) : (
          <Badge variant={warnaNilai(satuan.nilai)}>{satuan.nilai.toFixed(1)}</Badge>
        )}
      </div>

      {/* Pembilang dan penyebut tetap tampil meski nilainya ditahan. Justru
          angka itulah yang menerangkan mengapa nilainya ditahan. */}
      <p className="mt-2 text-sm tabular-nums">
        {satuan.terpenuhi !== undefined ? (
          <>
            {satuan.terpenuhi} dari {satuan.penyebut}
          </>
        ) : (
          <>{jumlahBukti} baris</>
        )}
        {satuan.belumMemenuhi ? (
          <span className="text-muted-foreground"> - {satuan.belumMemenuhi} belum memenuhi</span>
        ) : null}
      </p>

      {satuan.nilai === null && satuan.sebabTidakCukup ? (
        <p className="mt-1 text-xs leading-5 text-amber-800 dark:text-amber-300">
          {satuan.sebabTidakCukup}
        </p>
      ) : null}

      {satuan.selisihRingkas ? (
        <div className="mt-2 rounded-md border border-rose-300/70 bg-rose-50 p-2 text-xs leading-5 text-rose-800 dark:border-rose-700/50 dark:bg-rose-950/40 dark:text-rose-300">
          <strong>Temuan:</strong> kueri agregat memulangkan{" "}
          {satuan.selisihRingkas.dariRingkas.terpenuhi} dari{" "}
          {satuan.selisihRingkas.dariRingkas.penyebut}, sedangkan daftar buktinya{" "}
          {satuan.selisihRingkas.dariBaris.terpenuhi} dari{" "}
          {satuan.selisihRingkas.dariBaris.penyebut}. Yang tampil diambil dari buktinya.
        </div>
      ) : null}

      {jumlahBukti > 0 ? (
        <Button variant="outline" size="sm" className="mt-2" onClick={onBuka}>
          {terbuka ? "Tutup bukti" : `Lihat bukti (${jumlahBukti})`}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Daftar bukti. Kolomnya disusun dari ruas yang benar-benar ada pada barisnya,
 * bukan dari daftar yang ditulis di layar - tiap penilaian membawa ruas yang
 * berbeda, dan menuliskannya di sini berarti kolom yang menghilang diam-diam
 * begitu sebuah penilaian menambah ruas.
 */
function TabelBukti({ satuan }: { satuan: SatuanHasil }) {
  const kolom = useMemo(() => {
    const terkumpul: string[] = [];
    (satuan.bukti || []).forEach((b) => {
      Object.keys(b).forEach((k) => {
        if (!RUAS_BUKAN_KOLOM.has(k) && !terkumpul.includes(k)) terkumpul.push(k);
      });
    });
    return terkumpul;
  }, [satuan.bukti]);
  const baris = satuan.bukti || [];

  if (baris.length === 0) return null;

  return (
    <div className="rounded-lg border border-border/80">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-3 py-2 text-sm">
        <span className="font-medium">Bukti - {satuan.unit.label || satuan.unit.kunci}</span>
        {satuan.buktiDipotong ? (
          <span className="text-xs text-muted-foreground">
            {baris.length} dari {satuan.jumlahBukti} baris ditampilkan
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">{baris.length} baris, seluruhnya</span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/70 text-muted-foreground">
            <tr>
              {kolom.map((k) => (
                <th key={k} className="whitespace-nowrap px-3 py-2 font-semibold">
                  {judulRuas(k)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {baris.map((b, i) => (
              <tr
                key={String(b.kunci ?? i)}
                className={
                  b.memenuhi === false
                    ? "border-t border-border/70 bg-rose-50/60 dark:bg-rose-950/20"
                    : "border-t border-border/70"
                }
              >
                {kolom.map((k) => (
                  <td key={k} className="whitespace-nowrap px-3 py-2 tabular-nums">
                    {tampilkan(b[k])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Cara hitung dan ambangnya. Keduanya datang dari mesin yang benar-benar
 * menghitung, sehingga panel ini tidak dapat menerangkan rumus yang berbeda
 * dari yang dipakai.
 */
function PanelCaraHitung({
  caraHitung,
  ambang,
}: {
  caraHitung?: CaraHitung;
  ambang?: AmbangDipakai[];
}) {
  if (!caraHitung) return null;
  const baris: Array<[string, string | undefined]> = [
    ["Yang dihitung memenuhi", caraHitung.pembilang],
    ["Pembaginya", caraHitung.penyebut],
    ["Yang dikecualikan", caraHitung.dikecualikan],
    ["Tabel SIPP yang dibaca", caraHitung.tabelSumber],
    ["Ruas yang dibaca", caraHitung.ruasSumber],
  ];

  const belumBerlaku = (ambang || []).filter((a) => a && a.nilai === null);

  return (
    <div className="rounded-lg border border-border/80 bg-muted/30 p-3">
      <p className="mb-2 text-sm font-semibold">Cara hitung</p>
      <dl className="grid gap-2 text-sm md:grid-cols-2">
        {baris.map(([label, isi]) => (
          <div key={label}>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
            <dd className="leading-6">{isi || "-"}</dd>
          </div>
        ))}
      </dl>

      {(ambang || []).length > 0 ? (
        <div className="mt-3 border-t border-border/70 pt-3">
          <p className="mb-2 text-sm font-semibold">Ambang yang dipakai</p>
          <ul className="space-y-1 text-sm">
            {(ambang || []).map((a, i) => (
              <li key={a?.kunci || i} className="leading-6">
                {a && a.nilai !== null ? (
                  <>
                    <span className="font-medium tabular-nums">
                      {a.nilai} {a.satuan || ""}
                    </span>
                    {a.dasar ? (
                      <span className="text-muted-foreground"> - {a.dasar}</span>
                    ) : null}
                    {a.sifat ? <Badge variant="muted" className="ml-2">{a.sifat}</Badge> : null}
                  </>
                ) : (
                  <span className="text-amber-800 dark:text-amber-300">
                    {a?.sebab || "ambang ini belum berlaku pada tanggal periode yang dinilai"}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {belumBerlaku.length > 0 ? (
            <p className="mt-2 text-xs leading-5 text-amber-800 dark:text-amber-300">
              Ada ambang yang belum berlaku pada periode ini. Menilai dengan ambang yang belum
              berlaku berarti menilai orang dengan aturan yang belum ada.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * ============================================================================
 * PENCATATAN LAPORAN PERKARA - SATU-SATUNYA JALAN YANG PANTAS
 * ============================================================================
 *
 * Tanggal sebuah laporan dikirim tidak ada di SIPP. Ia hanya diketahui oleh
 * orang yang mengirimkannya. Sebelum layar ini ada, satu-satunya cara
 * memasukkannya adalah menulis langsung ke basis data - dan itu bukan cara yang
 * boleh diminta dari siapa pun.
 *
 * Nama pencatat TIDAK diketik di sini; ia diambil dari sesi yang sedang
 * berjalan. Ruas yang dapat diketik sendiri membuat catatannya tidak dapat
 * ditelusuri, dan catatan yang tidak dapat ditelusuri tidak berguna sebagai
 * bukti ketepatan waktu.
 */
function PencatatanLaporanPerkara() {
  const [lipa, setLipa] = useState<ButirLipa[]>([]);
  const [nomor, setNomor] = useState<number>(0);
  const [blangko, setBlangko] = useState<Blangko | null>(null);
  const [sedangMuat, setSedangMuat] = useState(false);
  const [isian, setIsian] = useState<Record<string, { tanggalKirim: string; angkaLaporan: string }>>({});
  const [sedangSimpan, setSedangSimpan] = useState("");
  const [pesan, setPesan] = useState("");

  const muatBlangko = useCallback(async (nomorLipa: number) => {
    if (!nomorLipa) return;
    setSedangMuat(true);
    setPesan("");
    try {
      const jawab = await ambilJson<Blangko>(`/api/aleta-penilaian/laporan?lipa=${nomorLipa}&bulan=12`);
      setBlangko(jawab);
      const awal: Record<string, { tanggalKirim: string; angkaLaporan: string }> = {};
      (jawab.baris || []).forEach((b) => {
        awal[b.bulanLaporan] = {
          tanggalKirim: b.tanggalKirim || "",
          angkaLaporan: b.angkaLaporan === null || b.angkaLaporan === undefined ? "" : String(b.angkaLaporan),
        };
      });
      setIsian(awal);
    } catch (galat) {
      setBlangko({ ok: false, alasan: galat instanceof Error ? galat.message : String(galat) });
    } finally {
      setSedangMuat(false);
    }
  }, []);

  /**
   * Daftar laporan, lalu blangko yang pertama.
   *
   * Keduanya dikerjakan di dalam satu rangkaian tak serentak. Memisahkannya
   * menjadi efek kedua yang mengintai `nomor` akan memuat ulang blangko tiap
   * kali keadaan lain berubah - dan tiap muat ulang membuang isian yang belum
   * disimpan petugas.
   */
  useEffect(() => {
    let dibatalkan = false;
    (async () => {
      try {
        const jawab = await ambilJson<{ lipa?: ButirLipa[] }>("/api/aleta-penilaian/laporan");
        if (dibatalkan) return;
        setLipa(jawab.lipa || []);
        if (jawab.lipa && jawab.lipa.length > 0) {
          setNomor(jawab.lipa[0].nomor);
          await muatBlangko(jawab.lipa[0].nomor);
        }
      } catch {
        // Daftar LIPA yang gagal diambil tidak perlu menampilkan galat merah -
        // bagian ini memang tambahan, dan penilaian di atasnya tetap berguna.
      }
    })();
    return () => {
      dibatalkan = true;
    };
  }, [muatBlangko]);

  const simpan = useCallback(
    async (bulanLaporan: string) => {
      const isi = isian[bulanLaporan];
      if (!isi) return;
      setSedangSimpan(bulanLaporan);
      setPesan("");
      try {
        const jawab = await ambilJson<{ ok?: boolean; alasan?: string; dicatatOleh?: string }>(
          "/api/aleta-penilaian/laporan",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lipaNomor: nomor,
              bulanLaporan,
              tanggalKirim: isi.tanggalKirim || null,
              angkaLaporan: isi.angkaLaporan === "" ? null : Number(isi.angkaLaporan),
            }),
          }
        );
        if (jawab.ok === false) {
          setPesan(jawab.alasan || "Tidak tersimpan.");
          return;
        }
        setPesan(
          `Tersimpan atas nama ${jawab.dicatatOleh || "pengguna yang sedang masuk"} untuk ${bulanLaporan}.`
        );
        await muatBlangko(nomor);
      } catch (galat) {
        setPesan(galat instanceof Error ? galat.message : String(galat));
      } finally {
        setSedangSimpan("");
      }
    },
    [isian, muatBlangko, nomor]
  );

  return (
    <Card className="border-border/80">
      <CardHeader>
        <CardTitle>Pencatatan Laporan Perkara</CardTitle>
        <CardDescription>
          Tanggal kirim tidak ada di SIPP dan tidak boleh ditebak. Yang dicatat di sini menjadi dasar
          penilaian ketepatan waktu kedua puluh dua laporan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,3fr)_auto]">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="lipa-nomor">
              Laporan
            </label>
            <NativeSelect
              id="lipa-nomor"
              value={String(nomor)}
              onChange={(e) => {
                const dipilih = Number(e.target.value);
                setNomor(dipilih);
                void muatBlangko(dipilih);
              }}
              disabled={lipa.length === 0}
            >
              {lipa.map((x) => (
                <option key={x.nomor} value={x.nomor}>
                  LIPA {x.nomor} - {x.nama}
                  {x.dipa04 ? " (DIPA 04)" : ""}
                </option>
              ))}
              {lipa.length ? null : <option value="0">(daftar belum terambil)</option>}
            </NativeSelect>
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={() => void muatBlangko(nomor)} disabled={!nomor || sedangMuat}>
              {sedangMuat ? "Memuat..." : "Muat ulang"}
            </Button>
          </div>
        </div>

        {pesan ? (
          <div className="rounded-md border border-border/80 bg-muted/50 p-3 text-sm">{pesan}</div>
        ) : null}

        {blangko && blangko.ok === false ? (
          <div className="rounded-md border border-rose-300/70 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-700/50 dark:bg-rose-950/40 dark:text-rose-300">
            {blangko.alasan || "Blangko tidak dapat diambil."}
          </div>
        ) : null}

        {blangko && blangko.baris ? (
          <div className="overflow-x-auto rounded-lg border border-border/80">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-muted/70 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-semibold">Bulan</th>
                  <th className="px-3 py-2 font-semibold">Batas kirim</th>
                  <th className="px-3 py-2 font-semibold">Tanggal kirim</th>
                  <th className="px-3 py-2 font-semibold">Telat</th>
                  <th className="px-3 py-2 font-semibold">Angka laporan</th>
                  <th className="px-3 py-2 font-semibold">Angka SIPP</th>
                  <th className="px-3 py-2 font-semibold">Nilai</th>
                  <th className="px-3 py-2 font-semibold">Simpan</th>
                </tr>
              </thead>
              <tbody>
                {blangko.baris.map((b) => {
                  const isi = isian[b.bulanLaporan] || { tanggalKirim: "", angkaLaporan: "" };
                  return (
                    <tr key={b.bulanLaporan} className="border-t border-border/70">
                      <td className="whitespace-nowrap px-3 py-2 font-medium">{b.bulanLaporan}</td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums">{b.batasKirim || "-"}</td>
                      <td className="px-3 py-2">
                        <Input
                          type="date"
                          className="h-9 w-40"
                          value={isi.tanggalKirim}
                          onChange={(e) =>
                            setIsian((s) => ({
                              ...s,
                              [b.bulanLaporan]: { ...isi, tanggalKirim: e.target.value },
                            }))
                          }
                        />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                        {b.terlambatHari === null || b.terlambatHari === undefined ? (
                          "-"
                        ) : b.terlambatHari > 0 ? (
                          <Badge variant="danger">{b.terlambatHari} hari</Badge>
                        ) : (
                          <Badge variant="success">tepat</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          className="h-9 w-32"
                          value={isi.angkaLaporan}
                          onChange={(e) =>
                            setIsian((s) => ({
                              ...s,
                              [b.bulanLaporan]: { ...isi, angkaLaporan: e.target.value },
                            }))
                          }
                        />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">
                        {b.angkaSipp === null || b.angkaSipp === undefined ? "belum disambung" : b.angkaSipp}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {b.nilai === null || b.nilai === undefined ? (
                          <Badge variant="muted" title={b.belumDapatDinilai || ""}>
                            belum dinilai
                          </Badge>
                        ) : (
                          <Badge variant={warnaNilai(b.nilai)}>{b.nilai.toFixed(1)}</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={sedangSimpan === b.bulanLaporan}
                          onClick={() => void simpan(b.bulanLaporan)}
                        >
                          {sedangSimpan === b.bulanLaporan ? "..." : "Simpan"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {blangko?.catatan ? (
          <p className="text-xs leading-5 text-muted-foreground">{blangko.catatan}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
