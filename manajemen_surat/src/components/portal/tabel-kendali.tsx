"use client";

import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

/**
 * Kendali tabel: pengurutan, penyaringan, dan pencarian.
 *
 * ============================================================================
 * SATU MESIN UNTUK JADWAL SIDANG DAN JADWAL MEDIASI
 * ============================================================================
 *
 * Keduanya tabel jadwal yang ditanya pertanyaan sejenis - urutkan menurut jam,
 * saring yang bermasalah, cari satu nomor perkara. Menulisnya dua kali berarti
 * dua perilaku yang perlahan berbeda: yang satu menaruh nilai kosong di atas,
 * yang lain di bawah, dan tidak ada yang menyadarinya sampai ada yang
 * membandingkan.
 *
 * ============================================================================
 * NILAI KOSONG SELALU DI BAWAH
 * ============================================================================
 *
 * Berapa pun arah urutannya. Mengurut menurut ruang sidang pada jadwal yang
 * separuh ruangnya belum ditentukan akan menaruh belasan baris kosong di
 * puncak - dan yang dicari orang justru yang terisi.
 *
 * Karena itu kosong bukan "nilai terkecil", melainkan "selalu terakhir".
 */

export type ArahUrut = "naik" | "turun";

export type Urutan = {
  kunci: string;
  arah: ArahUrut;
};

/**
 * Membandingkan dua nilai untuk pengurutan.
 *
 * Teks dibandingkan menurut kaidah bahasa Indonesia, bukan menurut kode
 * karakter: tanpa itu "Zainab" mendahului "ánis", dan huruf besar mendahului
 * seluruh huruf kecil.
 */
export function bandingkan(a: unknown, b: unknown): number {
  const kosongA = a === null || a === undefined || a === "";
  const kosongB = b === null || b === undefined || b === "";

  // Kosong tidak pernah ikut dibalik arahnya - ia selalu di bawah.
  if (kosongA && kosongB) return 0;
  if (kosongA) return 1;
  if (kosongB) return -1;

  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(b) - Number(a);

  return String(a).localeCompare(String(b), "id", { numeric: true, sensitivity: "base" });
}

/**
 * Mengurutkan salinan daftar, tanpa menyentuh yang asli.
 *
 * Urutannya STABIL: baris yang nilainya sama tetap pada urutan semula. Tanpa
 * itu, mengurut menurut majelis akan mengacak jam sidang di dalam tiap majelis,
 * dan jadwal yang tadinya urut jam jadi tidak dapat dibaca.
 */
export function urutkan<T>(
  daftar: T[],
  urutan: Urutan | null,
  ambil: (baris: T, kunci: string) => unknown
): T[] {
  if (!urutan) return daftar;

  const arah = urutan.arah === "naik" ? 1 : -1;

  return daftar
    .map((baris, posisi) => ({ baris, posisi }))
    .sort((kiri, kanan) => {
      const a = ambil(kiri.baris, urutan.kunci);
      const b = ambil(kanan.baris, urutan.kunci);

      // Kekosongan diperiksa DI SINI, bukan disimpulkan dari hasil bandingkan.
      // localeCompare juga mengembalikan 1 dan -1 untuk teks yang biasa saja,
      // sehingga menebak "kosong" dari angka hasilnya akan mengira separuh
      // perbandingan biasa sebagai kekosongan - dan urutan menurun berhenti
      // bekerja tanpa satu pun galat.
      const kosongA = a === null || a === undefined || a === "";
      const kosongB = b === null || b === undefined || b === "";
      if (kosongA && kosongB) return kiri.posisi - kanan.posisi;
      if (kosongA) return 1;
      if (kosongB) return -1;

      const hasil = bandingkan(a, b);
      if (hasil !== 0) return hasil * arah;
      return kiri.posisi - kanan.posisi;
    })
    .map((x) => x.baris);
}

/** Keadaan pengurutan satu tabel. */
export function useUrutan(bawaan: Urutan | null = null) {
  const [urutan, setUrutan] = useState<Urutan | null>(bawaan);

  /**
   * Menekan kepala kolom: naik, lalu turun, lalu kembali ke urutan asal.
   *
   * Putaran ketiga penting - tanpa jalan kembali, satu klik yang tidak
   * disengaja pada kolom mana pun mengunci tabelnya pada urutan itu, dan
   * satu-satunya cara pulih adalah memuat ulang halaman.
   */
  const tekan = (kunci: string) => {
    setUrutan((sekarang) => {
      if (!sekarang || sekarang.kunci !== kunci) return { kunci, arah: "naik" };
      if (sekarang.arah === "naik") return { kunci, arah: "turun" };
      return null;
    });
  };

  return { urutan, setUrutan, tekan };
}

/**
 * Kepala kolom yang dapat ditekan untuk mengurutkan.
 *
 * Anak panahnya SELALU ada, bahkan pada kolom yang belum diurutkan - berupa
 * panah dua arah yang samar. Panah yang baru muncul saat disentuh membuat
 * kolom yang dapat diurutkan tidak dapat dibedakan dari yang tidak, kecuali
 * dengan mencoba menekannya satu per satu.
 */
export function KepalaUrut({
  kunci,
  urutan,
  onTekan,
  className,
  rata = "kiri",
  judul,
  children,
}: {
  kunci: string;
  urutan: Urutan | null;
  onTekan: (kunci: string) => void;
  className?: string;
  rata?: "kiri" | "kanan" | "tengah";
  judul?: string;
  children: React.ReactNode;
}) {
  const aktif = urutan?.kunci === kunci;
  const naik = aktif && urutan?.arah === "naik";

  return (
    <th
      className={cn("px-3 py-2 font-medium", className)}
      aria-sort={aktif ? (naik ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onTekan(kunci)}
        title={judul ?? `Urutkan menurut ${typeof children === "string" ? children : kunci}`}
        className={cn(
          "inline-flex w-full items-center gap-1 rounded uppercase tracking-wide transition hover:text-foreground",
          rata === "kanan" && "justify-end",
          rata === "tengah" && "justify-center",
          aktif ? "text-foreground" : "text-muted-foreground"
        )}
      >
        <span>{children}</span>
        {aktif ? (
          naik ? (
            <ArrowUp className="h-3 w-3 shrink-0" />
          ) : (
            <ArrowDown className="h-3 w-3 shrink-0" />
          )
        ) : (
          <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-40" />
        )}
      </button>
    </th>
  );
}

/**
 * Warna penanda saringan.
 *
 * Namanya menyebut ARTI, bukan warnanya: "bahaya", bukan "merah". Yang dilihat
 * pembaca memang warnanya, tetapi yang menulis kode berikutnya perlu tahu
 * kenapa warna itu dipilih - dan "retur" berwarna merah karena ia bermasalah,
 * bukan karena merah kebetulan tersedia.
 */
export type NadaSaring = "bahaya" | "awas" | "aman" | "sejuk" | "netral";

const NADA: Record<NadaSaring, { mati: string; nyala: string }> = {
  bahaya: {
    mati: "border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40",
    nyala: "border-rose-500 bg-rose-500/15 text-rose-700 dark:text-rose-300",
  },
  awas: {
    mati: "border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-300 dark:hover:bg-amber-950/40",
    nyala: "border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  aman: {
    mati: "border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-950/40",
    nyala: "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  sejuk: {
    mati: "border-sky-300 text-sky-700 hover:bg-sky-50 dark:border-sky-900 dark:text-sky-300 dark:hover:bg-sky-950/40",
    nyala: "border-sky-500 bg-sky-500/15 text-sky-700 dark:text-sky-300",
  },
  netral: {
    mati: "border-border text-muted-foreground hover:bg-muted/60",
    nyala: "border-primary bg-primary/10 text-foreground",
  },
};

/**
 * Kotak kecil berwarna untuk menyaring.
 *
 * Yang jumlahnya NOL tetap digambar, dalam keadaan redup dan tidak dapat
 * ditekan. Menyembunyikannya membuat deretan saringan berubah-ubah tiap ganti
 * tanggal, dan yang mencari "retur" pada hari yang tidak ada returnya akan
 * mengira fiturnya hilang, bukan mengira angkanya nol.
 */
export function ChipSaring({
  label,
  jumlah,
  nada = "netral",
  aktif,
  onTekan,
  judul,
}: {
  label: string;
  jumlah: number;
  nada?: NadaSaring;
  aktif: boolean;
  onTekan: () => void;
  judul?: string;
}) {
  const kosong = jumlah === 0;
  const warna = NADA[nada];

  return (
    <button
      type="button"
      onClick={onTekan}
      disabled={kosong && !aktif}
      aria-pressed={aktif}
      title={judul}
      className={cn(
        "inline-flex items-baseline gap-1.5 rounded-lg border px-2.5 py-1 text-left text-xs transition",
        kosong && !aktif
          ? "cursor-default border-dashed border-border text-muted-foreground/50"
          : aktif
            ? warna.nyala
            : warna.mati
      )}
    >
      <span className="text-sm font-semibold tabular-nums">{jumlah}</span>
      <span>{label}</span>
    </button>
  );
}

/**
 * Membandingkan teks tanpa memedulikan huruf besar-kecil maupun tanda baca.
 *
 * Nomor perkara ditulis orang dengan cara yang berbeda-beda - "521/Pdt.G/2026",
 * "521/pdt.g/2026", kadang hanya "521". Pencarian yang menuntut ketepatan
 * huruf akan menjawab kosong pada ketiganya kecuali yang persis.
 */
export function cocokTeks(sumber: unknown, dicari: string): boolean {
  const kata = String(dicari || "").trim().toLowerCase();
  if (!kata) return true;
  return String(sumber ?? "").toLowerCase().includes(kata);
}

/** Satu medan pada pencarian lanjutan. */
export type MedanCari = {
  kunci: string;
  label: string;
  petunjuk?: string;
  /** "teks" isian bebas; "angka" rentang dari-sampai; "pilih" daftar tertutup. */
  jenis?: "teks" | "angka" | "pilih";
  pilihan?: string[];
};

export type IsianCari = Record<string, string>;

/**
 * Panel pencarian lanjutan.
 *
 * ============================================================================
 * TIAP MEDAN DIGABUNG DENGAN "DAN", BUKAN "ATAU"
 * ============================================================================
 *
 * "Majelis B DAN ruang 1" adalah pertanyaan yang benar-benar ditanya orang.
 * "Majelis B ATAU ruang 1" hampir tidak pernah - dan yang mengetik keduanya
 * mengharapkan penyempitan, bukan pelebaran.
 *
 * Yang dikosongkan tidak ikut menyaring sama sekali, sehingga panel yang
 * separuh terisi tetap berguna dan tidak perlu dibersihkan lebih dulu.
 */
export function PanelCariLanjut({
  medan,
  isian,
  onUbah,
  onBersihkan,
  jumlahAktif,
}: {
  medan: MedanCari[];
  isian: IsianCari;
  onUbah: (kunci: string, nilai: string) => void;
  onBersihkan: () => void;
  jumlahAktif: number;
}) {
  return (
    <div className="rounded-xl border bg-muted/20 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Pencarian lanjutan
        </p>
        <button
          type="button"
          onClick={onBersihkan}
          disabled={jumlahAktif === 0}
          className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:cursor-default disabled:opacity-40 disabled:no-underline"
        >
          Kosongkan {jumlahAktif > 0 ? `(${jumlahAktif})` : ""}
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {medan.map((satu) => {
          if (satu.jenis === "angka") {
            return (
              <label key={satu.kunci} className="text-xs">
                <span className="mb-1 block text-muted-foreground">{satu.label}</span>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={isian[`${satu.kunci}Dari`] ?? ""}
                    onChange={(e) => onUbah(`${satu.kunci}Dari`, e.target.value)}
                    placeholder="dari"
                    className="h-8 text-xs"
                  />
                  <span className="text-muted-foreground">–</span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={isian[`${satu.kunci}Sampai`] ?? ""}
                    onChange={(e) => onUbah(`${satu.kunci}Sampai`, e.target.value)}
                    placeholder="sampai"
                    className="h-8 text-xs"
                  />
                </div>
              </label>
            );
          }

          if (satu.jenis === "pilih") {
            return (
              <label key={satu.kunci} className="text-xs">
                <span className="mb-1 block text-muted-foreground">{satu.label}</span>
                <select
                  value={isian[satu.kunci] ?? ""}
                  onChange={(e) => onUbah(satu.kunci, e.target.value)}
                  className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="">Semua</option>
                  {(satu.pilihan ?? []).map((pilihan) => (
                    <option key={pilihan} value={pilihan}>
                      {pilihan}
                    </option>
                  ))}
                </select>
              </label>
            );
          }

          return (
            <label key={satu.kunci} className="text-xs">
              <span className="mb-1 block text-muted-foreground">{satu.label}</span>
              <Input
                value={isian[satu.kunci] ?? ""}
                onChange={(e) => onUbah(satu.kunci, e.target.value)}
                placeholder={satu.petunjuk}
                className="h-8 text-xs"
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}

/** Keadaan pencarian lanjutan, beserta jumlah medan yang sedang terisi. */
export function useCariLanjut() {
  const [isian, setIsian] = useState<IsianCari>({});

  const ubah = (kunci: string, nilai: string) =>
    setIsian((sekarang) => ({ ...sekarang, [kunci]: nilai }));

  const bersihkan = () => setIsian({});

  const jumlahAktif = useMemo(
    () => Object.values(isian).filter((x) => String(x ?? "").trim() !== "").length,
    [isian]
  );

  return { isian, ubah, bersihkan, jumlahAktif };
}

/**
 * Menyaring dengan rentang angka.
 *
 * Batas yang dikosongkan berarti tidak berbatas di sisi itu - "dari 5" tanpa
 * "sampai" berarti lima ke atas, bukan tepat lima.
 */
export function dalamRentang(nilai: number | null | undefined, dari: string, sampai: string) {
  const bawah = String(dari ?? "").trim();
  const atas = String(sampai ?? "").trim();
  if (!bawah && !atas) return true;
  // Yang tidak punya angka sama sekali tidak dapat dinyatakan masuk rentang,
  // dan menyatakannya masuk akan menyelipkan baris tanpa data ke dalam hasil
  // yang justru dicari karena angkanya.
  if (nilai === null || nilai === undefined || Number.isNaN(nilai)) return false;
  if (bawah && nilai < Number(bawah)) return false;
  if (atas && nilai > Number(atas)) return false;
  return true;
}
