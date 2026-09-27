"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ExternalLink, Info } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { apiPath, withBasePath } from "@/lib/base-path";
import {
  KEADAAN_SARING,
  SEBUTAN_PERAN,
  alamatRekapPetugas,
  alamatStatusPerkara,
  bacaIdSipp,
  peranRekapSah,
  teksBagian,
  teksHari,
  teksPersen,
  type Bagian,
  type BarisRekap,
  type KelompokRekap,
  type PeranRekap,
  type RekapPetugas as DataRekap,
} from "@/lib/rekap-petugas";
import { sebutanMediator } from "@/lib/sebutan-mediator";
import { tanggalDMY } from "@/lib/tanggal-indonesia";
import { cn } from "@/lib/utils";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";
import { kelasTulisanPutusan } from "@/lib/warna-putusan";

/**
 * ============================================================================
 * HALAMAN REKAP SATU PETUGAS
 * ============================================================================
 *
 * Dibuka dari nama pada layar Status Perkara, di tab baru (butir 6 dan 9
 * permintaan 27 September 2026). Seluruh angkanya dihitung bot atas SIPP
 * (rekapPetugasService); halaman ini hanya menuliskannya - dan menuliskan tiap
 * persentase BESERTA pembilang dan penyebutnya ("12 dari 40 · 30%"), sebab
 * persen tanpa penyebut tidak dapat dibantah.
 *
 * Tiga hal yang sengaja TIDAK dilakukan halaman ini:
 *
 *   - Menggambar "0" untuk yang tidak terbaca. Bila bacaan perkara gagal, yang
 *     tampil kalimat galatnya, bukan kartu-kartu bernilai nol.
 *   - Menebak orang dari nama. Alamatnya ?peran=...&id=... - id SIPP.
 *   - Menyebut "relaas yang dikerjakan" atau "sidang yang didampingi". SIPP
 *     tidak mencatat keduanya per orang; yang disebut adalah relaas dan sidang
 *     pada perkara TUGASANNYA, beserta dasar hitungnya.
 */

const SEBUTAN_KEADAAN: Record<BarisRekap["keadaan"], string> = {
  proses: "Masih proses",
  putus: "Putus, belum BHT",
  bht: "Sudah BHT",
};

const angka = (n: number) => n.toLocaleString("id-ID");

/** Batang persen tipis - hanya penanda mata; angkanya selalu tertulis. */
function BatangPersen({ persen, nada = "biasa" }: { persen: number | null; nada?: "biasa" | "perhatian" }) {
  const lebar = persen === null ? 0 : Math.max(0, Math.min(100, persen));
  return (
    <div className="h-1.5 w-full min-w-[4rem] overflow-hidden rounded-full bg-muted" aria-hidden>
      <div
        className={cn("h-full rounded-full", nada === "perhatian" ? "bg-amber-500" : "bg-primary/70")}
        style={{ width: `${lebar}%` }}
      />
    </div>
  );
}

/** Kartu angka ringkas - label, nilai, dan pembilang/penyebutnya. */
function KartuAngka({
  label,
  nilai,
  keterangan,
  nada,
}: {
  label: string;
  nilai: string;
  keterangan?: string;
  nada?: "perhatian";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        nada === "perhatian"
          ? "border-amber-300/60 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/10"
          : "border-border bg-card"
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums">{nilai}</p>
      {keterangan ? <p className="text-xs text-muted-foreground">{keterangan}</p> : null}
    </div>
  );
}

/** Nilai kartu dari satu bagian: persennya besar, pembilang/penyebutnya kecil. */
function kartuBagian(bagian: Bagian | null | undefined): { nilai: string; keterangan: string } {
  if (!bagian || bagian.penyebut <= 0) return { nilai: "—", keterangan: "tidak ada yang dihitung" };
  return { nilai: teksPersen(bagian.persen), keterangan: teksBagian(bagian) };
}

/** Tabel ringkasan per kelompok - per kedudukan, per tahun, per jenis perkara. */
function TabelKelompok({
  judulKolom,
  baris,
  label,
  ambangHari,
}: {
  judulKolom: string;
  baris: KelompokRekap[];
  label: (b: KelompokRekap) => string;
  ambangHari: number;
}) {
  if (baris.length === 0) return <p className="text-sm text-muted-foreground">Tidak ada perkara.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-sm">
        <thead className="border-b border-border text-left text-xs text-muted-foreground">
          <tr>
            <th className="py-1.5 pr-3 font-medium">{judulKolom}</th>
            <th className="py-1.5 pr-3 text-right font-medium">Perkara</th>
            <th className="py-1.5 pr-3 font-medium">Masih proses</th>
            <th className="py-1.5 pr-3 font-medium">Sudah putus</th>
            <th className="py-1.5 pr-3 font-medium">Sudah BHT</th>
            <th className="py-1.5 pr-3 font-medium">Selesai ≤ {ambangHari} hari</th>
            <th className="py-1.5 text-right font-medium">Lama rata-rata / median</th>
          </tr>
        </thead>
        <tbody>
          {baris.map((b) => (
            <tr key={String(b.kunci)} className="border-b border-border/60 align-top last:border-0">
              <td className="py-1.5 pr-3 font-medium">{label(b)}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums">{angka(b.jumlah)}</td>
              <td className="py-1.5 pr-3 tabular-nums">{teksBagian(b.keadaan.proses)}</td>
              <td className="py-1.5 pr-3 tabular-nums">{teksBagian(b.keadaan.putus)}</td>
              <td className="py-1.5 pr-3 tabular-nums">{teksBagian(b.keadaan.bht)}</td>
              <td className="py-1.5 pr-3 tabular-nums">{teksBagian(b.lama.dalamBatas)}</td>
              <td className="py-1.5 text-right tabular-nums">
                {teksHari(b.lama.rataHari)} / {teksHari(b.lama.medianHari)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Tabel "label | pembilang dari penyebut · persen | batang". */
function TabelBagian({
  baris,
  kelasLabel,
}: {
  baris: Array<Bagian & { label: string; kunci?: string }>;
  kelasLabel?: (label: string) => string;
}) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {baris.map((b) => (
          <tr key={b.kunci ?? b.label} className="border-b border-border/60 last:border-0">
            <td className={cn("py-1.5 pr-3", kelasLabel ? kelasLabel(b.label) : "")}>{b.label}</td>
            <td className="w-48 py-1.5 pr-3 text-right tabular-nums">{teksBagian(b)}</td>
            <td className="w-32 py-1.5">
              <BatangPersen persen={b.persen} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Catatan({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-xs text-muted-foreground">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

type Saringan = { tahun: string; keadaan: string; kedudukan: string };
const SARINGAN_KOSONG: Saringan = { tahun: "", keadaan: "", kedudukan: "" };
const BATAS_HALAMAN = 100;

/**
 * @param peran nilai ?peran= apa adanya dari alamat
 * @param id nilai ?id= apa adanya dari alamat
 */
export function RekapPetugas({ peran, id }: { peran: string; id: string }) {
  const peranSah: PeranRekap | null = peranRekapSah(peran) ? peran : null;
  const idSah = bacaIdSipp(id);

  const [saringan, setSaringan] = useState<Saringan>(SARINGAN_KOSONG);
  const [rekap, setRekap] = useState<DataRekap | null>(null);
  const [baris, setBaris] = useState<BarisRekap[]>([]);
  const [memuat, setMemuat] = useState(false);
  const [memuatLagi, setMemuatLagi] = useState(false);
  const [galat, setGalat] = useState("");
  // Nomor permintaan: jawaban yang datang SESUDAH saringan diganti lagi tidak
  // boleh menimpa jawaban saringan yang terbaru.
  const nomorMinta = useRef(0);

  const ambil = useCallback(
    async (lewati: number) => {
      if (!peranSah || idSah === null) return;
      const nomor = ++nomorMinta.current;
      if (lewati === 0) setMemuat(true);
      else setMemuatLagi(true);
      setGalat("");
      try {
        const kueri = new URLSearchParams({ peran: peranSah, id: String(idSah), batas: String(BATAS_HALAMAN) });
        if (saringan.tahun) kueri.set("tahun", saringan.tahun);
        if (saringan.keadaan) kueri.set("keadaan", saringan.keadaan);
        if (saringan.kedudukan) kueri.set("kedudukan", saringan.kedudukan);
        if (lewati > 0) kueri.set("lewati", String(lewati));
        const balasan = await fetch(apiPath(`/api/aleta-ecourt/rekap-petugas?${kueri.toString()}`), {
          cache: "no-store",
        });
        // Bungkus ok() portal: { ok, data } bila berhasil, { ok:false, error:{message} }
        // bila ditolak. Yang dibaca dua-duanya - kalimat penolakan (403, 400)
        // ditulis untuk dibaca petugas, bukan untuk diganti "gagal memuat".
        const isi = (await balasan.json().catch(() => null)) as {
          data?: { available?: boolean; rekap?: DataRekap | null; pesan?: string };
          error?: { message?: string };
        } | null;
        if (nomor !== nomorMinta.current) return;
        if (!balasan.ok) {
          setGalat(isi?.error?.message || `Rekap tidak dapat dibuka (HTTP ${balasan.status}).`);
          if (lewati === 0) setRekap(null);
          return;
        }
        const data = isi?.data;
        if (!data?.available || !data.rekap) {
          setGalat(data?.pesan || "ALETA Bot belum dapat dihubungi.");
          if (lewati === 0) setRekap(null);
          return;
        }
        setRekap(data.rekap);
        setBaris((lama) => (lewati === 0 ? data.rekap!.daftar.baris : [...lama, ...data.rekap!.daftar.baris]));
      } catch (e) {
        if (nomor !== nomorMinta.current) return;
        setGalat(e instanceof Error ? e.message : "Rekap tidak dapat dibuka.");
      } finally {
        if (nomor === nomorMinta.current) {
          setMemuat(false);
          setMemuatLagi(false);
        }
      }
    },
    [peranSah, idSah, saringan]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void ambil(0);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [ambil]);

  const identitas = rekap?.identitas;
  const sebutan = useMemo(() => {
    if (!rekap || !peranSah) return peranSah ? SEBUTAN_PERAN[peranSah] : "";
    if (peranSah === "mediator") return sebutanMediator(rekap.identitas.statusMediator);
    if (peranSah === "jurusita" && rekap.identitas.jabatan) return rekap.identitas.jabatan;
    return SEBUTAN_PERAN[peranSah];
  }, [rekap, peranSah]);

  // Judul tab: yang membuka beberapa rekap sekaligus perlu membedakan tabnya.
  useEffect(() => {
    if (!identitas?.nama) return;
    document.title = `Rekap ${sebutan} · ${identitas.nama}`;
  }, [identitas?.nama, sebutan]);

  const labelKedudukan = useMemo(() => {
    const peta = new Map<string, string>();
    for (const k of rekap?.menurutPeran ?? []) if (k.label) peta.set(String(k.kunci), k.label);
    return (kunci: string) => peta.get(kunci) ?? kunci;
  }, [rekap]);

  const labelMediasi = useMemo(() => {
    const peta = new Map<string, string>();
    for (const h of rekap?.mediasi?.hasil ?? []) peta.set(h.kunci, h.label);
    return (kunci: string) => peta.get(kunci) ?? kunci;
  }, [rekap]);

  if (!peranSah || idSah === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alamat rekap tidak lengkap</CardTitle>
          <CardDescription>
            Rekap petugas dibuka lewat nama hakim, panitera pengganti, juru sita, atau mediator pada layar
            Status Perkara. Alamatnya harus memuat peran (hakim, panitera, jurusita, atau mediator) dan ID
            SIPP berupa bilangan bulat - orangnya dikenali lewat ID, tidak lewat nama.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const ambang = rekap?.ambang.lamaPerkaraHari ?? 150;
  const ringkas = rekap?.ringkas;
  const adaMediasiDiDaftar = baris.some((b) => b.mediasi);

  return (
    <div className="flex flex-col gap-5">
      {/* ------------------------------------------------------------------ */}
      {/* Kepala: siapa, sebagai apa, dan dari mana angkanya.                 */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-1.5">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-primary sm:text-[0.72rem] sm:tracking-[0.2em]">
          ALETA e-Court · Rekap {sebutan || SEBUTAN_PERAN[peranSah]}
        </p>
        <h1 className="font-serif text-2xl leading-tight text-foreground sm:text-[2.1rem]">
          {identitas?.nama || (memuat ? "Memuat…" : `${SEBUTAN_PERAN[peranSah]} ${idSah}`)}
        </h1>
        {identitas ? (
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{sebutan}</Badge>
            <span>ID SIPP {identitas.id}</span>
            {identitas.kode ? <span>· kode {identitas.kode}</span> : null}
            {identitas.aktif === true ? <Badge variant="success">aktif di SIPP</Badge> : null}
            {identitas.aktif === false ? <Badge variant="muted">tidak aktif di SIPP</Badge> : null}
            {peranSah === "mediator" && identitas.bersertifikat !== null ? (
              <span>· {identitas.bersertifikat ? "bersertifikat" : "belum bersertifikat"}</span>
            ) : null}
            {/* Rekap peran lain orang yang sama - tautannya lewat id yang
                dicatat SIPP sendiri (mediator.hakim_id), bukan lewat nama. */}
            {peranSah === "mediator" && identitas.hakimId ? (
              <a
                className="inline-flex items-center gap-1 rounded-sm underline decoration-dotted underline-offset-2 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                href={withBasePath(alamatRekapPetugas("hakim", identitas.hakimId))}
              >
                Rekap sebagai hakim
              </a>
            ) : null}
            {peranSah === "hakim" && identitas.idMediator.length > 0 ? (
              <a
                className="inline-flex items-center gap-1 rounded-sm underline decoration-dotted underline-offset-2 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                href={withBasePath(alamatRekapPetugas("mediator", identitas.idMediator[0]))}
              >
                Rekap sebagai mediator
              </a>
            ) : null}
          </div>
        ) : null}
        {rekap ? (
          <p className="text-xs text-muted-foreground">
            Dihitung {tanggalDMY(waktuPengadilan(new Date(rekap.dihitungPada)).tanggal)}{" "}
            {waktuPengadilan(new Date(rekap.dihitungPada)).jam.slice(0, 5)} WITA atas SIPP satuan kerja
            {rekap.dariSinggahan ? " - dari hitungan yang disimpan dua menit" : ""}.
            {!identitas?.namaTerbaca ? " Nama orang ini tidak terbaca di SIPP." : ""}
            {identitas?.sumber && !["hakim_pn", "panitera_pn", "jurusita", "mediator"].includes(identitas.sumber)
              ? " Id ini tidak ada lagi di tabel rujukan petugas; namanya diambil dari penunjukan terakhirnya."
              : ""}
          </p>
        ) : null}
        {peranSah === "mediator" && identitas && identitas.idMediator.length > 1 ? (
          <Catatan>
            Dihitung atas mediator_id {identitas.idMediator.join(", ")} - seluruhnya tercatat untuk hakim_id{" "}
            {identitas.hakimId} di tabel mediator SIPP, jadi satu orang.
          </Catatan>
        ) : null}
      </div>

      {galat ? (
        <Card className="border-destructive/40">
          <CardContent className="py-4 text-sm text-destructive" role="alert">
            {galat}
          </CardContent>
        </Card>
      ) : null}

      {memuat && !rekap ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground" aria-live="polite">
            Menghitung rekap dari SIPP… Hitungan pertama dapat memakan beberapa detik.
          </CardContent>
        </Card>
      ) : null}

      {rekap && rekap.takTerbaca.length > 0 ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
          <div>
            <p className="font-medium">Sebagian keterangan tidak terbaca dari SIPP - angkanya tidak ditampilkan sebagai nol.</p>
            <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">
              {rekap.takTerbaca.map((x) => (
                <li key={x.bagian}>
                  {x.bagian}: {x.sebab}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {rekap && rekap.terpotong ? (
        <Catatan>Perkaranya melebihi pagu baca bot; hitungan di bawah atas bagian yang terbaca saja.</Catatan>
      ) : null}

      {rekap && ringkas && rekap.perkaraTerbaca ? (
        <>
          {/* ------------------------------------------------------------ */}
          {/* Angka ringkas                                                 */}
          {/* ------------------------------------------------------------ */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KartuAngka
              label={peranSah === "mediator" ? "Perkara yang dimediasi" : "Perkara ditangani"}
              nilai={angka(ringkas.jumlah)}
              keterangan={
                peranSah === "mediator"
                  ? "perkara yang mediasinya mencatat mediator ini"
                  : rekap.diganti
                    ? `${angka(rekap.diganti)} perkara lain: pernah ditunjuk lalu diganti, tidak dihitung`
                    : "penunjukan yang masih aktif"
              }
            />
            <KartuAngka label="Masih proses" {...kartuBagian(ringkas.keadaan.proses)} />
            <KartuAngka label="Sudah putus" {...kartuBagian(ringkas.keadaan.putus)} />
            <KartuAngka label="Sudah BHT" {...kartuBagian(ringkas.keadaan.bht)} />
            <KartuAngka label={`Selesai ≤ ${ambang} hari (5 bulan)`} {...kartuBagian(ringkas.lama.dalamBatas)} />
            <KartuAngka
              label={`Masih proses, sudah > ${ambang} hari`}
              {...kartuBagian(ringkas.lama.prosesLewatBatas)}
              nada={ringkas.lama.prosesLewatBatas.pembilang > 0 ? "perhatian" : undefined}
            />
            <KartuAngka label="Putusan verstek" {...kartuBagian(ringkas.verstek)} />
            <KartuAngka
              label="Lewat e-Court"
              {...(ringkas.ecourt ? kartuBagian(ringkas.ecourt) : { nilai: "—", keterangan: "tidak terbaca di SIPP ini" })}
            />
          </div>

          {/* ------------------------------------------------------------ */}
          {/* Per kedudukan                                                 */}
          {/* ------------------------------------------------------------ */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Menurut kedudukan</CardTitle>
              <CardDescription>
                {peranSah === "mediator"
                  ? "Perkara yang baris mediasinya di SIPP mencatat mediator_id orang ini."
                  : rekap.dasar.penugasan}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TabelKelompok
                judulKolom="Kedudukan"
                baris={rekap.menurutPeran}
                label={(b) => b.label || String(b.kunci)}
                ambangHari={ambang}
              />
            </CardContent>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* ---------------------------------------------------------- */}
            {/* Hasil putusan                                               */}
            {/* ---------------------------------------------------------- */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Hasil putusan</CardTitle>
                <CardDescription>{rekap.dasar.hasil}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {ringkas.hasil.length > 0 ? (
                  <TabelBagian baris={ringkas.hasil} kelasLabel={kelasTulisanPutusan} />
                ) : (
                  <p className="text-sm text-muted-foreground">Belum ada perkara yang putus.</p>
                )}
                <p className="text-sm">
                  <span className="text-muted-foreground">Dibanding: </span>
                  {ringkas.banding ? teksBagian(ringkas.banding) : "tidak terbaca di SIPP ini"}
                </p>
                {ringkas.verstek.tidakTercatat > 0 ? (
                  <Catatan>
                    {angka(ringkas.verstek.tidakTercatat)} putusan tanpa isian verstek di SIPP - tidak ikut penyebut
                    persentase verstek.
                  </Catatan>
                ) : null}
              </CardContent>
            </Card>

            {/* ---------------------------------------------------------- */}
            {/* Lama perkara                                                */}
            {/* ---------------------------------------------------------- */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Lama perkara</CardTitle>
                <CardDescription>{rekap.dasar.lama}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <KartuAngka label="Rata-rata" nilai={teksHari(ringkas.lama.rataHari)} />
                  <KartuAngka label="Median" nilai={teksHari(ringkas.lama.medianHari)} />
                </div>
                <p>
                  <span className="text-muted-foreground">Selesai paling lama {ambang} hari: </span>
                  {teksBagian(ringkas.lama.dalamBatas)}
                </p>
                <p>
                  <span className="text-muted-foreground">Masih proses dan sudah lewat {ambang} hari: </span>
                  {teksBagian(ringkas.lama.prosesLewatBatas)}
                </p>
                {ringkas.lama.tanpaTanggal > 0 ? (
                  <Catatan>{angka(ringkas.lama.tanpaTanggal)} perkara putus tanpa tanggal yang terbaca, tidak ikut dihitung.</Catatan>
                ) : null}
                <Catatan>{rekap.dasar.minutasi}</Catatan>
              </CardContent>
            </Card>
          </div>

          {/* ------------------------------------------------------------ */}
          {/* Mediasi                                                        */}
          {/* ------------------------------------------------------------ */}
          {rekap.mediasi ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {peranSah === "hakim" ? "Sebagai mediator" : "Mediasi"} — {angka(rekap.mediasi.jumlah)} mediasi pada{" "}
                  {angka(rekap.mediasi.perkara)} perkara
                </CardTitle>
                <CardDescription>{rekap.dasar.mediasi}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-2">
                <div>
                  <TabelBagian baris={rekap.mediasi.hasil} />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Berhasil = kesepakatan perdamaian {teksBagian(rekap.mediasi.berhasilRinci.kesepakatan)}, dan
                    pencabutan {teksBagian(rekap.mediasi.berhasilRinci.pencabutan)}.
                  </p>
                </div>
                <div className="flex flex-col gap-2 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <KartuAngka label="Lama rata-rata" nilai={teksHari(rekap.mediasi.lama.rataHari)} />
                    <KartuAngka label="Median" nilai={teksHari(rekap.mediasi.lama.medianHari)} />
                  </div>
                  <p>
                    <span className="text-muted-foreground">
                      Melewati {rekap.mediasi.lama.batasHari} hari (PERMA 1/2016 Pasal 24):{" "}
                    </span>
                    {teksBagian(rekap.mediasi.lama.lewatBatas)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">
                      Belum ada hasil dan sudah lebih dari {rekap.mediasi.lama.batasHari} hari sejak penetapan:{" "}
                    </span>
                    {angka(rekap.mediasi.lama.berjalanLewatBatas)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* ------------------------------------------------------------ */}
          {/* Relaas (juru sita) dan sidang (panitera)                      */}
          {/* ------------------------------------------------------------ */}
          {peranSah === "jurusita" ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Relaas pada perkara tugasannya</CardTitle>
                <CardDescription>{rekap.dasar.relaas}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {rekap.relaas ? (
                  <>
                    <p className="text-sm">
                      {angka(rekap.relaas.jumlah)} relaas pada {angka(rekap.relaas.perkara)} perkara.
                    </p>
                    <TabelBagian baris={rekap.relaas.cara.map((c) => ({ ...c, label: c.cara, kunci: c.sandi }))} />
                    <p className="text-sm">
                      <span className="text-muted-foreground">Surat tercatat ({angka(rekap.relaas.pos.jumlah)}): </span>
                      sampai {teksBagian(rekap.relaas.pos.sampai)}; kembali (retur) {teksBagian(rekap.relaas.pos.retur)};
                      belum dilacak {teksBagian(rekap.relaas.pos.belumDilacak)}.
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-amber-700 dark:text-amber-300">Relaas tidak terbaca dari SIPP.</p>
                )}
              </CardContent>
            </Card>
          ) : null}

          {peranSah === "panitera" ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Sidang pada perkara tugasannya</CardTitle>
                <CardDescription>{rekap.dasar.sidang}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm">
                {rekap.sidang ? (
                  <p>
                    {angka(rekap.sidang.jumlah)} sidang pada {angka(rekap.sidang.perkara)} perkara;{" "}
                    {angka(rekap.sidang.lewat)} sudah berlangsung, {angka(rekap.sidang.akanDatang)} akan datang. BAS
                    terunggah pada sidang yang sudah berlangsung: {teksBagian(rekap.sidang.bas)}.
                  </p>
                ) : (
                  <p className="text-amber-700 dark:text-amber-300">Sidang tidak terbaca dari SIPP.</p>
                )}
              </CardContent>
            </Card>
          ) : null}

          {/* ------------------------------------------------------------ */}
          {/* Per tahun dan per jenis                                       */}
          {/* ------------------------------------------------------------ */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Menurut tahun pendaftaran</CardTitle>
            </CardHeader>
            <CardContent>
              <TabelKelompok
                judulKolom="Tahun"
                baris={rekap.menurutTahun}
                label={(b) => String(b.kunci)}
                ambangHari={ambang}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Menurut jenis perkara</CardTitle>
            </CardHeader>
            <CardContent>
              <TabelKelompok
                judulKolom="Jenis perkara"
                baris={rekap.menurutJenis}
                label={(b) => String(b.kunci)}
                ambangHari={ambang}
              />
            </CardContent>
          </Card>

          {/* ------------------------------------------------------------ */}
          {/* Daftar perkara                                                */}
          {/* ------------------------------------------------------------ */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Daftar perkara</CardTitle>
              <CardDescription>
                Nomor perkara membuka Status Perkara ALETA di tab baru. Saringan hanya memotong daftar ini; angka di
                atas tetap atas seluruh perkara.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex min-w-[9rem] flex-col gap-1 text-xs text-muted-foreground">
                  Tahun daftar
                  <NativeSelect
                    aria-label="Saring tahun daftar"
                    value={saringan.tahun}
                    onChange={(e) => setSaringan((x) => ({ ...x, tahun: e.target.value }))}
                  >
                    <option value="">Semua tahun</option>
                    {rekap.daftar.pilihanTahun.map((t) => (
                      <option key={t} value={String(t)}>
                        {t}
                      </option>
                    ))}
                  </NativeSelect>
                </label>
                <label className="flex min-w-[10rem] flex-col gap-1 text-xs text-muted-foreground">
                  Keadaan
                  <NativeSelect
                    aria-label="Saring keadaan perkara"
                    value={saringan.keadaan}
                    onChange={(e) => setSaringan((x) => ({ ...x, keadaan: e.target.value }))}
                  >
                    {KEADAAN_SARING.map((k) => (
                      <option key={k.kunci} value={k.kunci}>
                        {k.label}
                      </option>
                    ))}
                  </NativeSelect>
                </label>
                {rekap.daftar.pilihanKedudukan.length > 1 ? (
                  <label className="flex min-w-[11rem] flex-col gap-1 text-xs text-muted-foreground">
                    Kedudukan
                    <NativeSelect
                      aria-label="Saring kedudukan"
                      value={saringan.kedudukan}
                      onChange={(e) => setSaringan((x) => ({ ...x, kedudukan: e.target.value }))}
                    >
                      <option value="">Semua kedudukan</option>
                      {rekap.daftar.pilihanKedudukan.map((k) => (
                        <option key={k.kunci} value={k.kunci}>
                          {k.label} ({angka(k.jumlah)})
                        </option>
                      ))}
                    </NativeSelect>
                  </label>
                ) : null}
                {saringan.tahun || saringan.keadaan || saringan.kedudukan ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => setSaringan(SARINGAN_KOSONG)}>
                    Hapus saringan
                  </Button>
                ) : null}
              </div>

              <p className="text-xs text-muted-foreground" aria-live="polite">
                {memuat ? "Memuat…" : `Menampilkan ${angka(baris.length)} dari ${angka(rekap.daftar.jumlah)} perkara.`}
              </p>

              {baris.length === 0 && !memuat ? (
                <p className="text-sm text-muted-foreground">Tidak ada perkara yang cocok dengan saringan ini.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[56rem] text-sm">
                    <caption className="sr-only">Daftar perkara {identitas?.nama}</caption>
                    <thead className="border-b border-border text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="py-1.5 pr-3 font-medium">Nomor perkara</th>
                        <th className="py-1.5 pr-3 font-medium">Didaftarkan</th>
                        <th className="py-1.5 pr-3 font-medium">Jenis</th>
                        <th className="py-1.5 pr-3 font-medium">Kedudukan</th>
                        <th className="py-1.5 pr-3 font-medium">Keadaan</th>
                        <th className="py-1.5 pr-3 font-medium">Putusan</th>
                        <th className="py-1.5 pr-3 text-right font-medium">Lama</th>
                        <th className="py-1.5 pr-3 font-medium">Verstek</th>
                        <th className="py-1.5 pr-3 font-medium">e-Court</th>
                        {adaMediasiDiDaftar ? <th className="py-1.5 font-medium">Mediasi</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {baris.map((b) => {
                        const alamat = alamatStatusPerkara(b.nomorPerkara);
                        const lama = b.tanggalPutusan ? b.lamaHari : b.umurHari;
                        const lewat = lama !== null && lama > ambang;
                        return (
                          <tr key={b.perkaraId} className="border-b border-border/60 align-top last:border-0">
                            <td className="py-1.5 pr-3 font-medium">
                              {alamat ? (
                                <a
                                  href={withBasePath(alamat)}
                                  target="_blank"
                                  rel="noopener"
                                  className="inline-flex items-center gap-1 rounded-sm underline decoration-dotted underline-offset-2 hover:text-primary hover:decoration-solid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring print:no-underline"
                                >
                                  {b.nomorPerkara}
                                  <ExternalLink className="h-3 w-3 shrink-0 print:hidden" aria-hidden />
                                  <span className="sr-only"> (Status Perkara dibuka di tab baru)</span>
                                </a>
                              ) : (
                                b.nomorPerkara || "—"
                              )}
                            </td>
                            <td className="py-1.5 pr-3 tabular-nums">{tanggalDMY(b.tanggalDaftar, "—")}</td>
                            <td className="py-1.5 pr-3">{b.jenisPerkara}</td>
                            <td className="py-1.5 pr-3">{b.kedudukan.map(labelKedudukan).join(", ")}</td>
                            <td className="py-1.5 pr-3">{SEBUTAN_KEADAAN[b.keadaan]}</td>
                            <td className={cn("py-1.5 pr-3", kelasTulisanPutusan(b.statusPutusan))}>
                              {b.tanggalPutusan ? (
                                <>
                                  {b.statusPutusan || "status tidak tercatat"}
                                  <span className="block text-xs text-muted-foreground">
                                    {tanggalDMY(b.tanggalPutusan)}
                                  </span>
                                </>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td
                              className={cn(
                                "py-1.5 pr-3 text-right tabular-nums",
                                lewat ? "text-amber-700 dark:text-amber-300" : ""
                              )}
                            >
                              {lama === null ? "—" : b.tanggalPutusan ? `${angka(lama)} hari` : `berjalan ${angka(lama)} hari`}
                            </td>
                            <td className="py-1.5 pr-3">{b.verstek === null ? "—" : b.verstek ? "Ya" : "Tidak"}</td>
                            <td className="py-1.5 pr-3">{b.ecourt === null ? "—" : b.ecourt ? "Ya" : "Tidak"}</td>
                            {adaMediasiDiDaftar ? (
                              <td className="py-1.5">
                                {b.mediasi ? (
                                  <>
                                    {labelMediasi(b.mediasi.golongan)}
                                    {b.mediasi.lamaHari !== null ? (
                                      <span className="block text-xs text-muted-foreground">
                                        {angka(b.mediasi.lamaHari)} hari
                                      </span>
                                    ) : null}
                                  </>
                                ) : (
                                  "—"
                                )}
                              </td>
                            ) : null}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {rekap.daftar.jumlah > baris.length ? (
                <div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={memuatLagi}
                    onClick={() => void ambil(baris.length)}
                  >
                    {memuatLagi ? "Memuat…" : `Muat ${angka(Math.min(BATAS_HALAMAN, rekap.daftar.jumlah - baris.length))} lagi`}
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Catatan>{rekap.dasar.keadaan}</Catatan>
        </>
      ) : null}

      {rekap && !rekap.perkaraTerbaca ? (
        <Card className="border-destructive/40">
          <CardContent className="py-4 text-sm text-destructive" role="alert">
            Perkara orang ini tidak dapat dibaca dari SIPP, sehingga angka rekapnya tidak ditampilkan - menampilkannya
            sebagai nol akan menyatakan orang ini tidak menangani perkara apa pun.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
