"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Archive, Download, Info, LoaderCircle } from "lucide-react";

import { usePortal } from "@/lib/app-state";
import { apiPath } from "@/lib/base-path";
import {
  FORMAT_EVIDEN_SKP,
  SEBUTAN_FORMAT_EVIDEN_SKP,
  alamatUnduhSkp,
  mulaiPeriodeSkpJabatan,
  namaDariDisposition,
  susunPeriodeSkpJabatan,
  type FormatEvidenSkp,
} from "@/lib/eviden-skp-unduh";
import { getEffectiveRoleId } from "@/lib/permissions";
import {
  LABEL_JABATAN_SKP,
  type JabatanSkp,
  type JenisSkp,
  type KunciBulanSkp,
  type KunciPeriodeSkpJabatan,
  type LembarSkp,
  type IsianManualSkp,
  type PeranAktorSkp,
  type PemetaanAkunPegawaiSkp,
  type TargetSkpJabatan,
} from "@/lib/skp-jabatan-tipe";
import { tanganiUnduhan } from "@/lib/unduh-berkas";
import { cn } from "@/lib/utils";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";

/**
 * ============================================================================
 * SKP JABATAN - PEMBANTU BERSAMA UNTUK LAYAR /skp
 * ============================================================================
 *
 * Bentuk jawaban rute /api/skp/* (buatan agen server) sengaja sedikit berbeda
 * dari tipe kontrak; yang dibaca di sini adalah bentuk jawaban yang sebenarnya.
 * Semua kalimat untuk pengguna berbahasa awam: tanpa nama kolom, kode jabatan,
 * atau kode galat.
 */

// ─── Bentuk jawaban rute ─────────────────────────────────────────────────────

export type KeteranganAktorSkp = {
  userId: string;
  peran: PeranAktorSkp;
  bolehUbahTarget: boolean;
  bolehLihatSemua: boolean;
};

export type BarisPegawaiSkp = {
  userId: string;
  nama: string;
  nip: string | null;
  jabatanUtama: JabatanSkp | null;
  labelJabatanUtama: string | null;
  jabatanTambahan: JabatanSkp[];
  jenisTersedia: JenisSkp[];
  atasanNama: string | null;
  aktif: boolean;
  alasanHak: string;
  bolehUbahIsian: boolean;
};

export type JawabanPegawaiSkp = {
  lingkup: "saya" | "bawahan" | "semua";
  aktor: KeteranganAktorSkp;
  pegawai: BarisPegawaiSkp[];
};

export type JawabanLembarSkp = {
  jenis: JenisSkp;
  periode: LembarSkp["periode"];
  pegawai: {
    userId: string;
    nama: string;
    nip: string | null;
    pangkatGolongan: string | null;
    jabatanUtama: JabatanSkp | null;
    jabatanTambahan: JabatanSkp[];
    atasanNama: string | null;
  };
  hak: { alasan: string; bolehUbahIsian: boolean; bolehUbahTarget: boolean; bolehTinjau: boolean };
  lembar: LembarSkp;
  sippTerjangkau: boolean;
  dariPenetapan: boolean;
  penetapan: {
    id: string;
    status: "draf" | "terkunci";
    dihitungPada: string;
    dikunciPada: string | null;
    pejabatPenilaiNama: string;
  } | null;
  akun: Array<{ username: string; tersirat: boolean; jendela: unknown }>;
  catatanOperator: string[];
  isian: IsianManualSkp[];
};

export type JawabanPemetaanSkp = {
  bolehUbah: boolean;
  pemetaan: PemetaanAkunPegawaiSkp[];
  pegawai: Array<{
    userId: string;
    nama: string;
    nip: string | null;
    jabatanUtama: JabatanSkp | null;
    jabatanTambahan: JabatanSkp[];
    saranUtama: JabatanSkp | null;
    saranTambahan: JabatanSkp[];
    akunProfil: string[];
    jumlahTautan: number;
  }>;
};

export type JawabanTargetSkp = {
  tahun: number;
  bolehUbah: boolean;
  target: TargetSkpJabatan[];
  jabatanDikenal: string[];
};

export type JawabanPenetapanSkp = {
  jenis: JenisSkp;
  periode: KunciPeriodeSkpJabatan;
  tahun: number;
  bolehTinjau: boolean;
  penetapan: {
    id: string;
    status: "draf" | "terkunci";
    dihitungPada: string;
    dikunciPada: string | null;
    dikunciOlehId: string | null;
    pejabatPenilaiNama: string;
  } | null;
  lembar: LembarSkp | null;
};

// ─── Panggilan rute ──────────────────────────────────────────────────────────

const PESAN_UMUM = "Permintaan belum berhasil. Coba lagi beberapa saat lagi.";

/** Membaca bungkus ok() rute JSON; kalimat galat rute diteruskan apa adanya. */
export async function ambilSkp<T>(alamat: string, init?: { metode?: "GET" | "PUT" | "POST"; badan?: unknown }): Promise<T> {
  const metode = init?.metode ?? "GET";
  const balasan = await fetch(apiPath(alamat), {
    method: metode,
    cache: "no-store",
    ...(init?.badan !== undefined
      ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(init.badan) }
      : {}),
  });
  const isi = (await balasan.json().catch(() => null)) as { ok?: boolean; data?: unknown; error?: { message?: string } } | null;
  if (!balasan.ok || !isi || isi.ok === false) {
    throw new Error(isi?.error?.message || PESAN_UMUM);
  }
  return isi.data as T;
}

export function pesanGalat(e: unknown): string {
  return e instanceof Error && e.message ? e.message : PESAN_UMUM;
}

/**
 * Mengambil data GET untuk layar. `memuat` DITURUNKAN (alamat/ulang sudah
 * berganti tetapi jawabannya belum datang), sehingga tidak ada setState
 * serempak di dalam efek. Jawaban lama tetap ditampilkan selama memuat ulang
 * dalam `grup` yang sama (mis. pegawai yang sama); berganti grup = kosong.
 */
export function useAmbilSkp<T>(alamat: string | null, grup = "", ulang = 0) {
  const kunci = alamat === null ? null : `${ulang}|${alamat}`;
  const [hasil, setHasil] = useState<{ kunci: string; grup: string; data: T | null; galat: string } | null>(null);
  useEffect(() => {
    if (kunci === null || alamat === null) return;
    let batal = false;
    ambilSkp<T>(alamat)
      .then((data) => {
        if (!batal) setHasil({ kunci, grup, data, galat: "" });
      })
      .catch((e) => {
        if (!batal) setHasil({ kunci, grup, data: null, galat: pesanGalat(e) });
      });
    return () => {
      batal = true;
    };
    // `alamat` sudah terkandung di dalam `kunci`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kunci, grup]);
  const sama = kunci !== null && hasil !== null && hasil.kunci === kunci;
  const grupSama = hasil !== null && hasil.grup === grup;
  return {
    data: kunci !== null && grupSama ? hasil.data : null,
    galat: sama ? hasil.galat : "",
    memuat: kunci !== null && !sama,
  };
}

// ─── Waktu dan periode ───────────────────────────────────────────────────────

export type ModePeriodeSkp = "bulan" | "triwulan" | "tahun";

export const NAMA_BULAN: readonly string[] = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export const PILIHAN_TRIWULAN: ReadonlyArray<{ kunci: "tw1" | "tw2" | "tw3" | "tw4"; label: string }> = [
  { kunci: "tw1", label: "Triwulan I" },
  { kunci: "tw2", label: "Triwulan II" },
  { kunci: "tw3", label: "Triwulan III" },
  { kunci: "tw4", label: "Triwulan IV" },
];

export function kunciBulan(nomor: number): KunciBulanSkp {
  return `b${String(nomor).padStart(2, "0")}` as KunciBulanSkp;
}

export function modeDariKunci(kunci: KunciPeriodeSkpJabatan): ModePeriodeSkp {
  if (kunci.startsWith("b")) return "bulan";
  if (kunci === "tahun") return "tahun";
  return "triwulan";
}

/** Bulan terakhir yang SUDAH selesai (Januari: Desember tahun lalu). */
export function bulanSelesaiTerakhir(hariIni: string): { tahun: number; periode: KunciBulanSkp } {
  const tahun = Number(hariIni.slice(0, 4));
  const bulan = Number(hariIni.slice(5, 7));
  if (bulan <= 1) return { tahun: tahun - 1, periode: "b12" };
  return { tahun, periode: kunciBulan(bulan - 1) };
}

/** Periode terpilih yang masih sah sesudah tahun diganti (periode yang belum dimulai diganti yang terdekat). */
export function periodeSahUntukTahun(
  periode: KunciPeriodeSkpJabatan,
  tahun: number,
  hariIni: string
): KunciPeriodeSkpJabatan {
  if (mulaiPeriodeSkpJabatan(periode, tahun) <= hariIni) return periode;
  const tahunIni = Number(hariIni.slice(0, 4));
  const bulanIni = Number(hariIni.slice(5, 7));
  if (modeDariKunci(periode) === "bulan") return tahun === tahunIni ? kunciBulan(bulanIni) : "b12";
  if (modeDariKunci(periode) === "triwulan") {
    if (tahun !== tahunIni) return "tw4";
    return (["tw1", "tw2", "tw3", "tw4"] as const)[Math.floor((bulanIni - 1) / 3)];
  }
  return periode;
}

export function labelPeriode(kunci: KunciPeriodeSkpJabatan, tahun: number): string {
  return susunPeriodeSkpJabatan(kunci, tahun).labelPanjang;
}

export function hariIniWita(): string {
  return waktuPengadilan().tanggal;
}

// ─── Teks awam ───────────────────────────────────────────────────────────────

/** Nama jenis SKP untuk pembaca: "SKP Pimpinan", "SKP Panitera Pengganti". */
export function namaJenisSkp(jenis: JenisSkp): string {
  if (jenis === "hakim") return "SKP Hakim";
  if (jenis === "pimpinan") return "SKP Pimpinan";
  return `SKP ${LABEL_JABATAN_SKP[jenis]}`;
}

export function namaJabatan(jabatan: JabatanSkp | null | undefined): string {
  return jabatan ? LABEL_JABATAN_SKP[jabatan] : "Belum ditentukan";
}

export const SEBUTAN_PERAN_AKTOR: Record<PeranAktorSkp, string> = {
  "super-admin": "Super Admin",
  admin: "Admin",
  ketua: "Ketua",
  "wakil-ketua": "Wakil Ketua",
  panitera: "Panitera",
  lainnya: "Pegawai",
};

export const SEBUTAN_ALASAN_HAK: Record<string, string> = {
  sendiri: "SKP sendiri",
  "atasan-langsung": "Bawahan langsung",
  ketua: "Dilihat sebagai Ketua",
  "wakil-ketua": "Dilihat sebagai Wakil Ketua (lihat saja)",
  panitera: "Dilihat sebagai Panitera",
  "super-admin": "Dilihat sebagai Super Admin",
  admin: "Dilihat sebagai Admin",
};

export const angka = (n: number) => n.toLocaleString("id-ID");

// ─── Hak di sisi layar ───────────────────────────────────────────────────────

/**
 * Pilihan "Jenis SKP" di menu Unduh eviden SKP hanya untuk Ketua dan Wakil
 * Ketua (peran EFEKTIF, sama dengan yang dipakai server). Tanpa penyedia
 * keadaan portal (mis. di uji yang berdiri sendiri) jawabannya tidak.
 */
export function useBolehPilihJenisSkp(): boolean {
  let pengguna: ReturnType<typeof usePortal>["currentUser"] = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    pengguna = usePortal().currentUser;
  } catch {
    return false;
  }
  const peran = getEffectiveRoleId(pengguna);
  return peran === "ketua" || peran === "wakil-ketua";
}

// ─── Potongan tampilan bersama ───────────────────────────────────────────────

export function KotakPesan({
  jenis,
  children,
  className,
}: {
  jenis: "galat" | "info" | "ok" | "peringatan";
  children: React.ReactNode;
  className?: string;
}) {
  const gaya =
    jenis === "galat"
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : jenis === "ok"
        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
        : jenis === "peringatan"
          ? "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200"
          : "border-border bg-muted/40 text-foreground";
  const Ikon = jenis === "info" || jenis === "ok" ? Info : AlertTriangle;
  return (
    <div
      role={jenis === "galat" ? "alert" : "status"}
      className={cn("flex items-start gap-2 rounded-lg border px-3 py-2 text-sm", gaya, className)}
    >
      <Ikon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function Memuat({ teks }: { teks: string }) {
  return (
    <p className="flex items-center gap-2 py-3 text-sm text-muted-foreground" role="status">
      <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
      {teks}
    </p>
  );
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("flex flex-col gap-1 text-xs font-medium text-muted-foreground", className)} {...props} />;
}

/** Penanda asal angka: "dari SIPP", "isian", atau "SIPP + isian". */
export function TandaSumber({ sumber }: { sumber: "sipp" | "isian" | "gabungan" }) {
  const teks = sumber === "sipp" ? "dari SIPP" : sumber === "isian" ? "isian" : "SIPP + isian";
  const kelas =
    sumber === "sipp"
      ? "border-sky-300/70 bg-sky-100 text-sky-800 dark:border-sky-700/50 dark:bg-sky-950/70 dark:text-sky-300"
      : sumber === "isian"
        ? "border-violet-300/70 bg-violet-100 text-violet-800 dark:border-violet-700/50 dark:bg-violet-950/70 dark:text-violet-300"
        : "border-teal-300/70 bg-teal-100 text-teal-800 dark:border-teal-700/50 dark:bg-teal-950/70 dark:text-teal-300";
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold", kelas)}>
      {teks}
    </span>
  );
}

// ─── Unduhan ─────────────────────────────────────────────────────────────────

/** Mengunduh lewat fetch supaya galat rute tampil sebagai kalimat, bukan berkas JSON bernama .pdf. */
export function useUnduhSkp() {
  const [sibuk, setSibuk] = useState<Record<string, boolean>>({});
  const [kabar, setKabar] = useState<{ jenis: "ok" | "galat"; teks: string } | null>(null);
  const unduh = useCallback(async (alamat: string) => {
    setSibuk((s) => ({ ...s, [alamat]: true }));
    setKabar(null);
    try {
      const balasan = await fetch(alamat, { cache: "no-store" });
      if (!balasan.ok) {
        const isi = (await balasan.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(isi?.error?.message || "Unduhan belum berhasil. Coba lagi beberapa saat lagi.");
      }
      const nama = namaDariDisposition(balasan.headers.get("content-disposition")) || "SKP";
      const hasil = await tanganiUnduhan(balasan, { namaCadangan: nama, nama, alamat });
      if (!hasil.ok) throw new Error(hasil.pesan);
      setKabar({ jenis: "ok", teks: `${nama} diunduh.` });
    } catch (e) {
      setKabar({ jenis: "galat", teks: pesanGalat(e) });
    } finally {
      setSibuk((s) => {
        const sisa = { ...s };
        delete sisa[alamat];
        return sisa;
      });
    }
  }, []);
  return { sibuk, kabar, unduh };
}

const KELAS_TOMBOL_UNDUH =
  "inline-flex h-9 min-w-[4.5rem] items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background";

/** Tombol PDF / Excel / Word untuk satu dokumen. */
export function BarisUnduhSkp({
  judul,
  ikonArsip,
  alamatDari,
  sibuk,
  onUnduh,
}: {
  judul: string;
  ikonArsip?: boolean;
  alamatDari: (format: FormatEvidenSkp) => string;
  sibuk: Record<string, boolean>;
  onUnduh: (alamat: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-center gap-2 text-sm font-medium">
        {ikonArsip ? <Archive className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
        {judul}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {FORMAT_EVIDEN_SKP.map((f) => {
          const alamat = alamatDari(f);
          const sedang = Boolean(sibuk[alamat]);
          return (
            <a
              key={f}
              href={alamat}
              download
              aria-label={`Unduh ${judul} sebagai ${SEBUTAN_FORMAT_EVIDEN_SKP[f]}`}
              aria-busy={sedang || undefined}
              data-format={f}
              onClick={(e) => {
                e.preventDefault();
                if (!sedang) onUnduh(alamat);
              }}
              className={cn(
                KELAS_TOMBOL_UNDUH,
                "border-border bg-card text-foreground shadow-sm hover:border-primary/40 hover:bg-accent/70 hover:text-accent-foreground",
                sedang && "pointer-events-none opacity-70"
              )}
            >
              {sedang ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Download className="h-3.5 w-3.5" aria-hidden />}
              {SEBUTAN_FORMAT_EVIDEN_SKP[f]}
            </a>
          );
        })}
      </div>
    </div>
  );
}

/** Alamat unduhan (sudah dengan alamat dasar aplikasi) untuk lembar jabatan perkara. */
export function alamatUnduhLembarSkp(p: {
  jenis: JenisSkp;
  pegawai: string;
  tahun: number;
  periode: KunciPeriodeSkpJabatan;
  dokumen: "lembar-skp" | "semua";
  format: FormatEvidenSkp;
  sertakanTambahan: boolean;
}): string {
  return apiPath(
    alamatUnduhSkp({
      jenis: p.jenis,
      pegawai: p.pegawai,
      tahun: p.tahun,
      periode: p.periode,
      dokumen: p.dokumen,
      format: p.format,
      sertakanTambahan: p.sertakanTambahan,
    })
  );
}
