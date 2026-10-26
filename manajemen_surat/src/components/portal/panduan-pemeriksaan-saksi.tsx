"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, ListChecks, Maximize2, Plus, Printer, RotateCcw, X } from "lucide-react";

import { Bagian } from "@/components/portal/bagian-ciut";
import { apiPath } from "@/lib/base-path";
import { bolehAksiLayar, type PenggunaGolongan } from "@/lib/matriks-peran";
import {
  PESAN_BELUM_ADA_PANDUAN,
  SIMPANAN_KOSONG,
  bacaSimpanan,
  daftarSaksiPandu,
  hapusSimpanan,
  hitungPokok,
  jenisPerkaraIdPandu,
  kelasLayarDariLebar,
  kunciCentang,
  kunciSimpanCentang,
  peringatanPokokWajib,
  tulisSimpanan,
  type CentangPandu,
  type IsiSimpanan,
  type KedudukanPokok,
  type KelasLayar,
  type PanduanIsianKeadaan,
  type PanduanPokok,
  type PanduanSaksi,
  type PanduanTanya,
  type PanduanTersedia,
  type PerkaraPandu,
  type PihakSaksi,
  type SaksiPandu,
} from "@/lib/pandu-saksi";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * PANDUAN PEMERIKSAAN SAKSI - JADWAL SIDANG DAN STATUS PERKARA
 * ============================================================================
 *
 * Diminta hakim 18 Oktober 2026: pertanyaan saksi dimasukkan ke Jadwal Sidang
 * (rincian baris sidang) dan Status Perkara "agar memandu saat sidang".
 *
 * Satu komponen, dua tempat. Isinya PERTANYAAN dan unsur pembuktian saja:
 * contoh jawaban saksi tidak pernah dikirim ke layar ini (rute memotongnya),
 * supaya panduan tidak mengarahkan saksi. Contoh jawaban tetap hanya ada di
 * ekstensi, untuk menyusun berita acara.
 *
 * Centang "sudah ditanyakan" hanya disimpan di peramban ini (per perkara per
 * sidang). Tidak ada yang ditulis ke SIPP maupun ABT.
 */

export type PemuatPanduan = (kueri: URLSearchParams) => Promise<PanduanSaksi>;

const SEBUTAN_KELAS: Readonly<Record<KelasLayar, string>> = {
  ponsel: "text-sm",
  tablet: "text-sm",
  laptop: "text-sm",
  tv: "text-lg",
};

/** Ukuran pertanyaan di mode layar sidang: HP, tablet, laptop hakim, dan TV 40-65 inci. */
const UKURAN_LAYAR_SIDANG: Readonly<Record<KelasLayar, { tanya: string; tombol: string; kepala: string }>> = {
  ponsel: { tanya: "text-2xl leading-snug", tombol: "min-h-14 text-lg", kepala: "text-sm" },
  tablet: { tanya: "text-4xl leading-snug", tombol: "min-h-16 text-xl", kepala: "text-base" },
  laptop: { tanya: "text-5xl leading-tight", tombol: "min-h-16 text-2xl", kepala: "text-lg" },
  tv: { tanya: "text-7xl leading-tight", tombol: "min-h-24 text-4xl", kepala: "text-3xl" },
};

async function muatDariRute(kueri: URLSearchParams): Promise<PanduanSaksi> {
  const jawaban = await fetch(apiPath(`/api/aleta-ecourt/pandu-saksi?${kueri.toString()}`), {
    cache: "no-store",
    credentials: "same-origin",
  });
  let isi: { data?: { panduan?: PanduanSaksi }; error?: { message?: string } } = {};
  try {
    isi = await jawaban.json();
  } catch {
    isi = {};
  }
  if (!jawaban.ok || !isi.data?.panduan) {
    throw new Error(isi.error?.message || "Panduan pertanyaan belum dapat dimuat. Coba lagi sebentar.");
  }
  return isi.data.panduan;
}

function useKelasLayar(): KelasLayar {
  const [kelas, setKelas] = useState<KelasLayar>(() =>
    typeof window === "undefined" ? "laptop" : kelasLayarDariLebar(window.innerWidth)
  );
  useEffect(() => {
    const sesuaikan = () => setKelas(kelasLayarDariLebar(window.innerWidth));
    sesuaikan();
    window.addEventListener("resize", sesuaikan);
    return () => window.removeEventListener("resize", sesuaikan);
  }, []);
  return kelas;
}

const adaNilai = (x: string | string[] | undefined) => (Array.isArray(x) ? x.length > 0 : Boolean(x));

// ─── Pembungkus: hak peran dan bagian yang dapat dilipat ─────────────────────

export type PropsPanduanSaksi = {
  perkara: PerkaraPandu;
  sidangId?: string;
  tanggalSidang?: string;
  agenda?: string;
  /** Keadaan yang sudah dibaca layar (kehadiran dari sidang SIPP, kumulasi). */
  keadaanAwal?: Record<string, string | string[]>;
  /** Nama saksi tiap pihak menurut SIPP. */
  namaSaksi?: { P?: ReadonlyArray<string>; T?: ReadonlyArray<string> };
  /** Menonjol: agenda pembuktian atau pemeriksaan saksi. */
  menonjol?: boolean;
  /**
   * "lipat" (bawaan, Status Perkara): bagian lipat di halaman.
   * "tombol" (Jadwal Sidang, 18 Okt 2026): hanya tombol kecil; panduan keluar sebagai jendela pop-up
   * ketika ditekan, tidak pernah terbuka sendiri.
   */
  bentuk?: "lipat" | "tombol";
  /** Awalan kunci lipatan; tiap tempat memakai awalan sendiri. */
  kunciBagian: string;
  /** undefined = layar lepas (tidak dibatasi); rute tetap menegakkan hak. */
  pengguna?: PenggunaGolongan | null;
  namaPengadilan?: string;
  muat?: PemuatPanduan;
};

/**
 * Bagian lipat "Panduan pertanyaan saksi". Tidak digambar sama sekali bagi
 * peran yang tidak berhak (hakim, panitera, panitera muda, panitera pengganti,
 * admin, dan super admin).
 */
export function PanduanPemeriksaanSaksi(props: PropsPanduanSaksi) {
  const { menonjol = false, kunciBagian, pengguna, bentuk = "lipat" } = props;
  if (!bolehAksiLayar(pengguna, "pandu.saksi")) return null;
  if (bentuk === "tombol") return <TombolPanduSaksi {...props} />;
  return (
    <div
      data-pandu-saksi-bagian=""
      data-menonjol={menonjol ? "ya" : "tidak"}
      className={cn("rounded-xl", menonjol && "ring-2 ring-primary/60 ring-offset-2 ring-offset-background")}
    >
      <Bagian
        // Pembuktian dibuka sendiri; pada agenda lain bawaannya terlipat. Kunci berbeda supaya pilihan
        // peramban untuk keduanya tidak saling menimpa.
        judul="Panduan pertanyaan saksi"
        kunci={menonjol ? `${kunciBagian}-pembuktian` : kunciBagian}
        ciutBawaan={!menonjol}
        keterangan={menonjol ? "agenda pembuktian: panduan terbuka" : ""}
      >
        {/* Dipasang ulang bila perkara atau sidangnya berganti, supaya centang yang diingat selalu milik sidang ini. */}
        <PanduanPemeriksaanSaksiIsi key={kunciSimpanCentang(props.perkara.nomorPerkara, props.sidangId ?? "")} {...props} />
      </Bagian>
    </div>
  );
}

// ─── Tombol kecil dan jendela pop-up (Jadwal Sidang) ─────────────────────────

/**
 * Tombol "Pertanyaan saksi". Panduannya TIDAK dimuat dan TIDAK digambar sampai
 * tombol ditekan: jendela pop-up memasang isi yang sama dengan bagian lipat
 * (pokok wajib, centang, layar sidang, cetak). Centang tetap tersimpan per
 * perkara per sidang, jadi menutup lalu membuka lagi tidak menghilangkannya.
 */
function TombolPanduSaksi(props: PropsPanduanSaksi) {
  const [buka, setBuka] = useState(false);
  const tutup = useCallback(() => setBuka(false), []);
  const nomor = props.perkara.nomorPerkara;
  return (
    <>
      <button
        type="button"
        data-tombol-pandu-saksi={nomor}
        data-menonjol={props.menonjol ? "ya" : "tidak"}
        aria-haspopup="dialog"
        aria-expanded={buka}
        onClick={() => setBuka(true)}
        title={`Pertanyaan saksi untuk perkara ${nomor}: panduan pertanyaan, pokok wajib, layar sidang, dan cetak`}
        className={cn(
          "inline-flex max-w-full items-center justify-center gap-1 rounded-md border px-2 py-1 text-center text-xs leading-tight transition",
          props.menonjol
            ? "border-primary/60 bg-primary/10 font-semibold text-primary hover:bg-primary/20"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <ListChecks className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>Pertanyaan saksi</span>
      </button>
      {buka ? <JendelaPanduSaksi {...props} onTutup={tutup} /> : null}
    </>
  );
}

function JendelaPanduSaksi({ onTutup, ...props }: PropsPanduanSaksi & { onTutup: () => void }) {
  const kotak = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const awal = document.activeElement as HTMLElement | null;
    kotak.current?.focus();
    const lamaGulir = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const tekan = (e: KeyboardEvent) => {
      // Layar sidang (di atas jendela ini) menutup dirinya sendiri dengan Esc; jendela ini menunggu.
      if (e.key === "Escape" && !document.querySelector("[data-pandu-layar-sidang]")) onTutup();
    };
    window.addEventListener("keydown", tekan);
    return () => {
      window.removeEventListener("keydown", tekan);
      document.body.style.overflow = lamaGulir;
      if (awal && document.contains(awal)) awal.focus();
    };
  }, [onTutup]);

  if (typeof document === "undefined") return null;
  const nomor = props.perkara.nomorPerkara;

  return createPortal(
    <div
      data-pandu-saksi-jendela=""
      className="fixed inset-0 z-[150] flex items-stretch justify-center tirai-latar sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onTutup();
      }}
    >
      <div
        ref={kotak}
        role="dialog"
        aria-modal="true"
        aria-label={`Pertanyaan saksi ${nomor}`}
        tabIndex={-1}
        className="flex min-h-0 w-full max-w-5xl flex-col overflow-hidden bg-background text-foreground shadow-xl outline-none sm:max-h-[94vh] sm:rounded-xl sm:border 2xl:max-w-7xl"
      >
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <ListChecks className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm font-semibold">
            Pertanyaan saksi <span className="font-normal text-muted-foreground">· {nomor}</span>
          </p>
          <button
            type="button"
            onClick={onTutup}
            className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted/60"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" /> Tutup
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          {/* Dipasang ulang bila perkara atau sidangnya berganti, supaya centang yang diingat selalu milik sidang ini. */}
          <PanduanPemeriksaanSaksiIsi key={kunciSimpanCentang(props.perkara.nomorPerkara, props.sidangId ?? "")} {...props} />
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Isi panduan ─────────────────────────────────────────────────────────────

type Tahap = "memuat" | "siap" | "gagal";

export function PanduanPemeriksaanSaksiIsi({
  perkara,
  sidangId = "",
  tanggalSidang = "",
  keadaanAwal,
  namaSaksi,
  namaPengadilan = "",
  muat = muatDariRute,
}: PropsPanduanSaksi) {
  const kelas = useKelasLayar();
  const [pilihan, setPilihan] = useState<Record<string, string | string[]>>({});
  const [sensitif, setSensitif] = useState(false);
  const [hasilMuat, setHasilMuat] = useState<{ kunci: string; panduan: PanduanSaksi | null; pesan: string } | null>(null);
  const [bagian, setBagian] = useState<"saksi" | "keterangan">("saksi");
  const [pihak, setPihak] = useState<PihakSaksi>("P");
  const [peranAktif, setPeranAktif] = useState("");
  const [layarSidang, setLayarSidang] = useState(false);
  const [cetak, setCetak] = useState(false);
  const [ulangMuat, setUlangMuat] = useState(0);

  const jenisId = jenisPerkaraIdPandu(perkara);
  const keadaanKirim = useMemo(() => ({ ...(keadaanAwal ?? {}), ...pilihan }), [keadaanAwal, pilihan]);
  const kunciKeadaan = JSON.stringify(keadaanKirim);
  const kunciMuat = JSON.stringify([jenisId, perkara.alurPerkaraId ?? "", perkara.jenisPerkara ?? "", perkara.mafqud === true, kunciKeadaan, sensitif, ulangMuat]);

  // ── Muat panduan menurut jenis dan keadaan ──
  // Panduan yang sudah ada tetap tampil selama yang baru dimuat; "memuat" diturunkan dari kunci, bukan disetel.
  useEffect(() => {
    let batal = false;
    const kueri = new URLSearchParams();
    if (jenisId) kueri.set("jenisPerkaraId", String(jenisId));
    if (perkara.alurPerkaraId) kueri.set("alurPerkaraId", String(perkara.alurPerkaraId));
    // I28 18 Okt: penetapan mafqud berbagi jenis 369 "Lain-Lain"; katalognya dikenali dari nama, jadi tandanya ditambahkan.
    const namaJenis = [perkara.jenisPerkara, perkara.mafqud === true ? "mafqud" : ""].filter(Boolean).join(" ");
    if (namaJenis) kueri.set("jenisPerkara", namaJenis);
    kueri.set("keadaan", kunciKeadaan);
    if (sensitif) kueri.set("sensitif", "1");
    muat(kueri).then(
      (hasil) => {
        if (!batal) setHasilMuat({ kunci: kunciMuat, panduan: hasil, pesan: "" });
      },
      (galat: unknown) => {
        if (batal) return;
        const pesanGagal = galat instanceof Error ? galat.message : "Panduan pertanyaan belum dapat dimuat.";
        setHasilMuat((lama) => ({ kunci: kunciMuat, panduan: lama?.panduan ?? null, pesan: pesanGagal }));
      }
    );
    return () => {
      batal = true;
    };
  }, [jenisId, perkara.alurPerkaraId, perkara.jenisPerkara, perkara.mafqud, kunciKeadaan, kunciMuat, sensitif, muat]);
  const panduan: PanduanSaksi | null = hasilMuat?.panduan ?? null;
  const tahap: Tahap = hasilMuat?.kunci !== kunciMuat ? "memuat" : hasilMuat.pesan ? "gagal" : "siap";
  const pesan = hasilMuat?.pesan ?? "";

  // ── Centang: hanya di peramban ini ──
  const kunciSimpan = kunciSimpanCentang(perkara.nomorPerkara, sidangId);
  // Dibaca sekali saat dipasang; komponen dipasang ulang (key) bila perkara atau sidangnya berganti.
  const [isi, setIsi] = useState<IsiSimpanan>(() => bacaSimpanan(kunciSimpan));
  const isiRef = useRef<IsiSimpanan>(isi);
  const ubah = useCallback(
    (fungsi: (lama: IsiSimpanan) => IsiSimpanan) => {
      const baru = fungsi(isiRef.current);
      isiRef.current = baru;
      setIsi(baru);
      tulisSimpanan(kunciSimpan, baru);
    },
    [kunciSimpan]
  );
  const ganti = useCallback(
    (kunci: string) => ubah((lama) => ({ ...lama, centang: { ...lama.centang, [kunci]: !lama.centang[kunci] } })),
    [ubah]
  );
  const kosongkan = () => {
    isiRef.current = SIMPANAN_KOSONG;
    setIsi(SIMPANAN_KOSONG);
    hapusSimpanan(kunciSimpan);
  };

  const tersedia: PanduanTersedia | null = panduan && panduan.tersedia ? panduan : null;
  const adaKeterangan = Boolean(tersedia?.keterangan && tersedia.keterangan.peran.length > 0);
  const bagianAktif = bagian === "keterangan" && adaKeterangan ? "keterangan" : "saksi";
  const kehadiran = tersedia ? tersedia.keadaanDipakai.kehadiran : undefined;
  const kunciNamaP = JSON.stringify(namaSaksi?.P ?? []);
  const kunciNamaT = JSON.stringify(namaSaksi?.T ?? []);
  const namaP = useMemo(() => JSON.parse(kunciNamaP) as string[], [kunciNamaP]);
  const namaT = useMemo(() => JSON.parse(kunciNamaT) as string[], [kunciNamaT]);
  const tampilT = !(kehadiran === "verstek" && namaT.length === 0);
  const pihakAktif: PihakSaksi = pihak === "T" && !tampilT ? "P" : pihak;
  const saksiPihak = useMemo(
    () => daftarSaksiPandu(pihakAktif, pihakAktif === "P" ? namaP : namaT, isi.tambahan[pihakAktif]),
    [pihakAktif, namaP, namaT, isi.tambahan]
  );

  const peranKeterangan = tersedia?.keterangan?.peran ?? [];
  const peranDipakai = peranKeterangan.find((p) => p.kode === peranAktif) ?? peranKeterangan[0];

  // Daftar yang sedang ditampilkan: pokok + "saksi" (untuk keterangan: satu kolom per pemberi keterangan).
  const tampilan = useMemo(() => {
    if (!tersedia) return null;
    if (bagianAktif === "keterangan" && peranDipakai) {
      const saksi: SaksiPandu[] = [{ kunci: `K:${peranDipakai.kode}`, nama: "Sudah ditanyakan" }];
      return { pokok: peranDipakai.pokok, saksi, judul: peranDipakai.label, hitungSaksi: false };
    }
    return { pokok: tersedia.saksi[pihakAktif].pokok, saksi: saksiPihak, judul: tersedia.saksi[pihakAktif].label, hitungSaksi: true };
  }, [tersedia, bagianAktif, peranDipakai, pihakAktif, saksiPihak]);

  const kedudukan: KedudukanPokok[] = useMemo(
    () => (tampilan ? hitungPokok(tampilan.pokok, tampilan.saksi, isi.centang) : []),
    [tampilan, isi.centang]
  );
  const peringatan = tampilan?.hitungSaksi ? peringatanPokokWajib(kedudukan) : [];

  // ── Keadaan perkara yang dapat diubah ──
  const isianTampil = (tersedia?.keadaan ?? []).filter((i) => i.untuk === (bagianAktif === "keterangan" ? "keterangan" : "saksi"));
  const ubahKeadaan = (isian: PanduanIsianKeadaan, nilai: string | string[]) =>
    setPilihan((lama) => {
      const baru = { ...lama };
      if (!adaNilai(nilai)) delete baru[isian.kunci];
      else baru[isian.kunci] = nilai;
      return baru;
    });
  const dariSidang = (kunci: string) => adaNilai(keadaanAwal?.[kunci]) && !adaNilai(pilihan[kunci]);

  // ── Tampilan ──
  if (tahap === "memuat" && !panduan) {
    return (
      <p className="text-sm" data-pandu-status="memuat" aria-busy="true">
        {"\u00a0"}
      </p>
    );
  }
  if (tahap === "gagal" && !panduan) {
    return (
      <div className="space-y-2" data-pandu-status="gagal">
        <p className="text-sm text-amber-700 dark:text-amber-300">{pesan}</p>
        <button
          type="button"
          onClick={() => setUlangMuat((n) => n + 1)}
          className="rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted/50"
        >
          Muat ulang panduan
        </button>
      </div>
    );
  }
  if (!panduan || !panduan.tersedia || !tersedia || !tampilan) {
    return (
      <p className="text-sm text-muted-foreground" data-pandu-status="belum-ada">
        {panduan && !panduan.tersedia ? panduan.alasan : PESAN_BELUM_ADA_PANDUAN}.
      </p>
    );
  }

  const butirLayar = tampilan.pokok.flatMap((p) => p.tanya.map((t) => ({ pokok: p, tanya: t })));

  return (
    <div
      data-pandu-saksi=""
      data-kelas-layar={kelas}
      data-bagian={bagianAktif}
      className={cn("min-w-0 space-y-3", SEBUTAN_KELAS[kelas])}
    >
      {/* Kepala: apa yang dipandu, dan alat-alatnya */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-[1_1_18rem]">
          <p className="font-semibold">
            {tersedia.judul}
            <span className="font-normal text-muted-foreground"> · {tampilan.judul}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Hanya pertanyaan dan unsur yang perlu digali. Centang disimpan di peramban ini saja dan tidak ditulis ke SIPP.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setLayarSidang(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-primary/50 bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20"
        >
          <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" /> Layar sidang
        </button>
        <button
          type="button"
          onClick={() => setCetak(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted/50"
        >
          <Printer className="h-3.5 w-3.5" aria-hidden="true" /> Cetak lembar panduan
        </button>
        <button
          type="button"
          onClick={kosongkan}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted/50"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Kosongkan centang
        </button>
      </div>

      {/* Pilihan bagian: saksi, atau keterangan anak/calon/orang tua (dispensasi kawin) */}
      {adaKeterangan ? (
        <div role="tablist" aria-label="Bagian panduan" className="flex flex-wrap gap-1.5">
          {(
            [
              ["saksi", "Pertanyaan saksi"],
              ["keterangan", "Keterangan anak, calon, dan orang tua"],
            ] as const
          ).map(([kunci, label]) => (
            <button
              key={kunci}
              type="button"
              role="tab"
              aria-selected={bagianAktif === kunci}
              onClick={() => setBagian(kunci)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs font-semibold",
                bagianAktif === kunci ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted/50"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {bagianAktif === "saksi" ? (
        <div className="space-y-1.5">
          <div role="tablist" aria-label="Saksi dari pihak" className="flex flex-wrap gap-1.5">
            {(["P", ...(tampilT ? (["T"] as const) : [])] as PihakSaksi[]).map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={pihakAktif === k}
                onClick={() => setPihak(k)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs font-semibold",
                  pihakAktif === k ? "border-primary bg-primary/15 text-primary" : "border-border hover:bg-muted/50"
                )}
              >
                {tersedia.saksi[k].label}
                <span className="font-normal text-muted-foreground"> ({k === "P" ? Math.max(namaP.length, 0) : Math.max(namaT.length, 0)} terdaftar)</span>
              </button>
            ))}
          </div>
          {pihakAktif === "T" && tersedia.tergugatBerbeda ? (
            <p className="text-xs text-muted-foreground">
              Pertanyaan khusus saksi {tersedia.sebutan.dua} menyesuaikan bantahan {tersedia.sebutan.dua}; pilih bantahannya pada Keadaan perkara di bawah.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2">
          <div role="tablist" aria-label="Yang didengar keterangannya" className="flex flex-wrap gap-1.5">
            {peranKeterangan.map((p) => (
              <button
                key={p.kode}
                type="button"
                role="tab"
                aria-selected={peranDipakai?.kode === p.kode}
                onClick={() => setPeranAktif(p.kode)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs font-semibold",
                  peranDipakai?.kode === p.kode ? "border-primary bg-primary/15 text-primary" : "border-border hover:bg-muted/50"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          {tersedia.keterangan?.adaButirSensitif ? (
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input type="checkbox" className="mt-0.5" checked={sensitif} onChange={(e) => setSensitif(e.target.checked)} />
              <span>
                Tampilkan pertanyaan tentang keadaan yang mendorong pernikahan (kehamilan atau hubungan badan). Bersifat peka; tampilkan hanya bila Majelis memandang perlu.
              </span>
            </label>
          ) : null}
        </div>
      )}

      {/* Keadaan perkara: mengubah pertanyaan yang ditampilkan */}
      {isianTampil.length > 0 ? (
        <details className="rounded-lg border bg-muted/20 px-3 py-2" data-pandu-keadaan="">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Keadaan perkara
            <span className="ml-2 font-normal normal-case">
              {isianTampil
                .map((i) => {
                  const terpilih = i.nilai.filter((n) => i.terpilih.includes(n.nilai)).map((n) => n.label);
                  return terpilih.length > 0 ? terpilih.join(", ") : "";
                })
                .filter(Boolean)
                .slice(0, 3)
                .join(" · ")}
            </span>
          </summary>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {isianTampil.map((i) => (
              <fieldset key={i.kunci} className="min-w-0 space-y-1">
                <legend className="text-xs font-medium">
                  {i.label}
                  {dariSidang(i.kunci) ? <span className="ml-1 font-normal text-muted-foreground">(terbaca dari sidang)</span> : null}
                </legend>
                {i.jamak ? (
                  <div className="flex flex-col gap-1">
                    {i.nilai.map((n) => {
                      const aktif = i.terpilih.includes(n.nilai);
                      return (
                        <label key={n.nilai} className="flex items-start gap-2 text-xs">
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={aktif}
                            onChange={() => {
                              const lama = i.terpilih;
                              ubahKeadaan(i, aktif ? lama.filter((x) => x !== n.nilai) : [...lama, n.nilai]);
                            }}
                          />
                          <span>{n.label}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <select
                    className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                    value={i.terpilih[0] ?? ""}
                    onChange={(e) => ubahKeadaan(i, e.target.value)}
                    aria-label={i.label}
                  >
                    <option value="">Belum dipilih</option>
                    {i.nilai.map((n) => (
                      <option key={n.nilai} value={n.nilai}>
                        {n.label}
                      </option>
                    ))}
                  </select>
                )}
              </fieldset>
            ))}
          </div>
        </details>
      ) : null}

      {/* Peringatan pokok wajib */}
      {tampilan.hitungSaksi ? (
        peringatan.length > 0 ? (
          <div
            role="status"
            data-pandu-peringatan="ada"
            className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-amber-900 dark:text-amber-200"
          >
            <p className="text-xs font-semibold">Pokok wajib yang belum ditanyakan kepada minimal 2 saksi</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
              {peringatan.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p
            role="status"
            data-pandu-peringatan="tidak-ada"
            className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-900 dark:text-emerald-200"
          >
            Semua pokok wajib sudah ditanyakan kepada minimal 2 saksi.
          </p>
        )
      ) : null}

      {/* Saksi: nama dari SIPP, dapat ditambah */}
      {tampilan.hitungSaksi ? (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Saksi:</span>
          {saksiPihak.map((s, urutan) => (
            <span key={s.kunci} className="rounded-full border bg-card px-2.5 py-1" title={s.nama}>
              {urutan + 1}. <span className="inline-block max-w-[12rem] truncate align-bottom">{s.nama}</span>
            </span>
          ))}
          {saksiPihak.length < (pihakAktif === "P" ? 5 : 4) ? (
            <button
              type="button"
              onClick={() => ubah((lama) => ({ ...lama, tambahan: { ...lama.tambahan, [pihakAktif]: lama.tambahan[pihakAktif] + 1 } }))}
              className="inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1 hover:bg-muted/50"
            >
              <Plus className="h-3 w-3" aria-hidden="true" /> Tambah saksi
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Daftar pertanyaan per pokok */}
      <div className="space-y-3" data-pandu-daftar="">
        {tampilan.pokok.length === 0 ? <p className="text-muted-foreground">Tidak ada pertanyaan untuk keadaan ini.</p> : null}
        {kedudukan.map((k, urutanPokok) => (
          <section key={k.pokok.id} className="rounded-lg border bg-card" data-pokok={k.pokok.wajib ? "wajib" : "biasa"}>
            <header className="flex flex-wrap items-start gap-2 border-b px-3 py-2">
              <h6 className="min-w-0 flex-[1_1_14rem] font-semibold">
                {urutanPokok + 1}. {k.pokok.judul}
              </h6>
              {k.pokok.wajib ? (
                <span className="rounded-full border border-rose-400/60 bg-rose-500/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-rose-700 dark:text-rose-300">
                  Wajib
                </span>
              ) : (
                <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">Bila perlu</span>
              )}
              {tampilan.hitungSaksi ? (
                <span className="text-xs text-muted-foreground">
                  lengkap pada {k.saksiLengkap} dari {tampilan.saksi.length} saksi
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {k.tercentang} dari {k.jumlahButirInti} sudah ditanyakan
                </span>
              )}
            </header>
            {k.pokok.uraian ? <p className="px-3 pt-2 text-xs text-muted-foreground">{k.pokok.uraian}</p> : null}
            {k.pokok.dasarHukum.length > 0 ? (
              <p className="px-3 pt-1 text-xs text-muted-foreground">
                <span className="font-medium">Dasar hukum: </span>
                {k.pokok.dasarHukum.map((d, i) => (
                  <span key={d.rujukan} title={d.uraian}>
                    {i > 0 ? "; " : ""}
                    {d.rujukan}
                  </span>
                ))}
              </p>
            ) : null}
            <ol className="px-3 pb-2">
              {k.pokok.tanya.map((t, urutan) => (
                <BarisPertanyaan
                  key={t.id}
                  nomor={urutan + 1}
                  tanya={t}
                  saksi={tampilan.saksi}
                  centang={isi.centang}
                  onGanti={ganti}
                  tampilkanNamaSaksi={tampilan.hitungSaksi}
                />
              ))}
            </ol>
          </section>
        ))}
      </div>

      {layarSidang ? (
        <LayarSidang
          butir={butirLayar}
          saksi={tampilan.saksi}
          centang={isi.centang}
          onGanti={ganti}
          kelas={kelas}
          judul={`${tersedia.judul} · ${tampilan.judul}`}
          onTutup={() => setLayarSidang(false)}
        />
      ) : null}

      {cetak ? (
        <LembarCetak
          perkara={perkara}
          tanggalSidang={tanggalSidang}
          namaPengadilan={namaPengadilan}
          panduan={tersedia}
          judul={tampilan.judul}
          pokok={tampilan.pokok}
          saksi={tampilan.saksi}
          centang={isi.centang}
          keadaan={isianTampil}
          onSelesai={() => setCetak(false)}
        />
      ) : null}
    </div>
  );
}

// ─── Satu baris pertanyaan ───────────────────────────────────────────────────

function BarisPertanyaan({
  nomor,
  tanya,
  saksi,
  centang,
  onGanti,
  tampilkanNamaSaksi,
}: {
  nomor: number;
  tanya: PanduanTanya;
  saksi: SaksiPandu[];
  centang: CentangPandu;
  onGanti: (kunci: string) => void;
  tampilkanNamaSaksi: boolean;
}) {
  return (
    <li className="grid gap-1.5 border-t py-2 first:border-t-0 md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-4" data-butir={tanya.id}>
      <p className="min-w-0 leading-snug">
        <span className="mr-1 text-muted-foreground">{nomor}.</span>
        {tanya.teks}
        {tanya.tingkat === "tambahan" ? (
          <span className="ml-1.5 rounded-full border px-1.5 py-0.5 align-middle text-[10px] text-muted-foreground">sesuai keadaan</span>
        ) : tanya.tingkat === "pilihan" ? (
          <span className="ml-1.5 rounded-full border px-1.5 py-0.5 align-middle text-[10px] text-muted-foreground">bila perlu</span>
        ) : null}
      </p>
      <div className="flex flex-wrap gap-1.5 md:justify-end">
        {saksi.map((s, urutan) => {
          const kunci = kunciCentang(s.kunci, tanya.id);
          const aktif = centang[kunci] === true;
          const label = tampilkanNamaSaksi ? `Saksi ${urutan + 1}` : s.nama;
          return (
            <label
              key={s.kunci}
              title={tampilkanNamaSaksi ? s.nama : undefined}
              className={cn(
                "inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs",
                aktif ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200" : "border-border hover:bg-muted/50"
              )}
            >
              <input
                type="checkbox"
                checked={aktif}
                onChange={() => onGanti(kunci)}
                aria-label={`${tampilkanNamaSaksi ? `${label}, ${s.nama}` : s.nama}: sudah ditanyakan: ${tanya.teks}`}
              />
              <span>{label}</span>
            </label>
          );
        })}
      </div>
    </li>
  );
}

// ─── Mode layar sidang ───────────────────────────────────────────────────────

function LayarSidang({
  butir,
  saksi,
  centang,
  onGanti,
  kelas,
  judul,
  onTutup,
}: {
  butir: Array<{ pokok: PanduanPokok; tanya: PanduanTanya }>;
  saksi: SaksiPandu[];
  centang: CentangPandu;
  onGanti: (kunci: string) => void;
  kelas: KelasLayar;
  judul: string;
  onTutup: () => void;
}) {
  const [indeks, setIndeks] = useState(0);
  const jumlah = butir.length;
  const maju = useCallback(() => setIndeks((i) => Math.min(jumlah - 1, i + 1)), [jumlah]);
  const mundur = useCallback(() => setIndeks((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    const tekan = (e: KeyboardEvent) => {
      if (e.key === "Escape") onTutup();
      else if (e.key === "ArrowRight" || e.key === "PageDown") maju();
      else if (e.key === "ArrowLeft" || e.key === "PageUp") mundur();
    };
    window.addEventListener("keydown", tekan);
    return () => window.removeEventListener("keydown", tekan);
  }, [maju, mundur, onTutup]);

  const ukuran = UKURAN_LAYAR_SIDANG[kelas];
  const sekarang = butir[Math.min(indeks, Math.max(0, jumlah - 1))];

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Layar sidang: panduan pertanyaan saksi"
      data-pandu-layar-sidang=""
      data-kelas-layar={kelas}
      className="fixed inset-0 z-[200] flex flex-col bg-background p-4 text-foreground sm:p-8"
    >
      <div className={cn("flex flex-wrap items-center gap-3", ukuran.kepala)}>
        <p className="min-w-0 flex-1 font-semibold">{judul}</p>
        <p className="tabular-nums text-muted-foreground" data-pandu-posisi="">
          Pertanyaan {jumlah === 0 ? 0 : indeks + 1} dari {jumlah}
        </p>
        <button
          type="button"
          onClick={onTutup}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 font-semibold hover:bg-muted/50"
        >
          <X className="h-4 w-4" aria-hidden="true" /> Tutup
        </button>
      </div>

      {sekarang ? (
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-6 py-6">
          <div className={cn("flex flex-wrap items-center gap-3", ukuran.kepala)}>
            <span className="font-medium text-muted-foreground">{sekarang.pokok.judul}</span>
            {sekarang.pokok.wajib ? (
              <span className="rounded-full border border-rose-400/60 bg-rose-500/10 px-3 py-0.5 font-bold uppercase text-rose-700 dark:text-rose-300">
                Wajib
              </span>
            ) : null}
          </div>
          <h2 className={cn("font-bold", ukuran.tanya)} data-pandu-pertanyaan="">
            {sekarang.tanya.teks}
          </h2>
          <div className="flex flex-wrap gap-3">
            {saksi.map((s, urutan) => {
              const kunci = kunciCentang(s.kunci, sekarang.tanya.id);
              const aktif = centang[kunci] === true;
              return (
                <button
                  key={s.kunci}
                  type="button"
                  aria-pressed={aktif}
                  onClick={() => onGanti(kunci)}
                  className={cn(
                    "rounded-xl border-2 px-5 font-semibold",
                    ukuran.tombol,
                    aktif ? "border-emerald-500 bg-emerald-500/15 text-emerald-900 dark:text-emerald-200" : "border-border hover:bg-muted/50"
                  )}
                >
                  {aktif ? "✓ " : ""}
                  {saksi.length > 1 ? `Saksi ${urutan + 1}` : s.nama}
                  <span className="ml-2 font-normal text-muted-foreground">{saksi.length > 1 ? "sudah ditanya" : ""}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <p className={cn("flex-1 py-10", ukuran.tanya)}>Tidak ada pertanyaan untuk keadaan ini.</p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={mundur}
          disabled={indeks <= 0}
          className={cn("inline-flex flex-1 items-center justify-center gap-2 rounded-xl border-2 font-semibold disabled:opacity-40", ukuran.tombol)}
        >
          <ChevronLeft className="h-6 w-6" aria-hidden="true" /> Sebelumnya
        </button>
        <button
          type="button"
          onClick={maju}
          disabled={indeks >= jumlah - 1}
          className={cn(
            "inline-flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-primary bg-primary font-semibold text-primary-foreground disabled:opacity-40",
            ukuran.tombol
          )}
        >
          Berikutnya <ChevronRight className="h-6 w-6" aria-hidden="true" />
        </button>
      </div>
      <p className={cn("pt-2 text-center text-muted-foreground", ukuran.kepala)}>Tombol panah kiri dan kanan berpindah pertanyaan; Esc menutup.</p>
    </div>,
    document.body
  );
}

// ─── Lembar cetak (A4) ───────────────────────────────────────────────────────

const GAYA_CETAK = `
@media print {
  body > *:not(#aleta-cetak-pandu-saksi) { display: none !important; }
  #aleta-cetak-pandu-saksi { display: block !important; }
  @page { size: A4 portrait; margin: 14mm; }
}
#aleta-cetak-pandu-saksi { display: none; }
`;

function LembarCetak({
  perkara,
  tanggalSidang,
  namaPengadilan,
  panduan,
  judul,
  pokok,
  saksi,
  centang,
  keadaan,
  onSelesai,
}: {
  perkara: PerkaraPandu;
  tanggalSidang: string;
  namaPengadilan: string;
  panduan: PanduanTersedia;
  judul: string;
  pokok: PanduanPokok[];
  saksi: SaksiPandu[];
  centang: CentangPandu;
  keadaan: PanduanIsianKeadaan[];
  onSelesai: () => void;
}) {
  useEffect(() => {
    // Dicetak sesudah lembarnya tergambar; pada putaran yang sama sebagian peramban mencetak halaman kosong.
    const timer = window.setTimeout(() => {
      window.print();
      onSelesai();
    }, 150);
    return () => window.clearTimeout(timer);
  }, [onSelesai]);

  if (typeof document === "undefined") return null;
  const keadaanTertulis = keadaan
    .map((i) => {
      const terpilih = i.nilai.filter((n) => i.terpilih.includes(n.nilai)).map((n) => n.label);
      return terpilih.length > 0 ? `${i.label}: ${terpilih.join(", ")}` : "";
    })
    .filter(Boolean);
  const sel = { border: "1px solid #000", padding: "3px 5px", verticalAlign: "top" } as const;

  return createPortal(
    <div id="aleta-cetak-pandu-saksi" style={{ color: "#000", background: "#fff", fontFamily: "serif" }}>
      <style>{GAYA_CETAK}</style>
      <h1 style={{ margin: 0, fontSize: "15pt", textAlign: "center" }}>PANDUAN PEMERIKSAAN SAKSI</h1>
      {namaPengadilan ? <h2 style={{ margin: "2px 0 0", fontSize: "12pt", textAlign: "center", fontWeight: 600 }}>{namaPengadilan}</h2> : null}
      <p style={{ margin: "6px 0 0", fontSize: "10.5pt", textAlign: "center" }}>
        Perkara Nomor {perkara.nomorPerkara}
        {tanggalSidang ? ` · Sidang ${tanggalSidang}` : ""}
      </p>
      <p style={{ margin: "2px 0 0", fontSize: "10.5pt", textAlign: "center" }}>
        {panduan.judul} · {judul}
      </p>
      {keadaanTertulis.length > 0 ? (
        <p style={{ margin: "3px 0 8px", fontSize: "9pt", textAlign: "center", fontStyle: "italic" }}>{keadaanTertulis.join(" · ")}</p>
      ) : null}
      {pokok.map((p, urutan) => (
        <div key={p.id} style={{ marginTop: "8px", breakInside: "avoid" }}>
          <p style={{ margin: "0 0 2px", fontSize: "10.5pt", fontWeight: 700 }}>
            {urutan + 1}. {p.judul}
            {p.wajib ? " (WAJIB)" : ""}
          </p>
          {p.dasarHukum.length > 0 ? (
            <p style={{ margin: "0 0 3px", fontSize: "8.5pt" }}>Dasar hukum: {p.dasarHukum.map((d) => d.rujukan).join("; ")}</p>
          ) : null}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10pt" }}>
            <thead>
              <tr>
                <th style={{ ...sel, width: "24px" }}>No</th>
                <th style={{ ...sel, textAlign: "left" }}>Pertanyaan</th>
                {saksi.map((s, i) => (
                  <th key={s.kunci} style={{ ...sel, width: "46px", fontSize: "8.5pt" }}>
                    {saksi.length > 1 ? `Saksi ${i + 1}` : "Ditanya"}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {p.tanya.map((t, i) => (
                <tr key={t.id}>
                  <td style={{ ...sel, textAlign: "center" }}>{i + 1}</td>
                  <td style={sel}>{t.teks}</td>
                  {saksi.map((s) => (
                    <td key={s.kunci} style={{ ...sel, textAlign: "center", fontSize: "12pt" }}>
                      {centang[kunciCentang(s.kunci, t.id)] === true ? "☑" : "☐"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>,
    document.body
  );
}

