"use client";

import { useCallback, useState } from "react";
import { BookOpen, Loader2, TriangleAlert } from "lucide-react";

import { apiPath } from "@/lib/base-path";

/**
 * RUJUKAN TERBUKA DI TEMPAT (H2).
 *
 * ============================================================================
 * MEMBUKA PASAL DI TAB LAIN BERARTI PASALNYA TIDAK DIBUKA
 * ============================================================================
 *
 * Draf memuat rujukan pasal di hampir tiap alinea. Selama membacanya menuntut
 * membuka tab lain, mencari peraturannya, lalu menggulir ke pasalnya, yang
 * terjadi bukan "hakim membaca pasalnya di tempat lain" melainkan "hakim tidak
 * membaca pasalnya". Bukan karena malas - karena satu putusan berisi belasan
 * rujukan, dan belasan kali perjalanan itu memakan lebih banyak waktu daripada
 * yang dipunyai siapa pun pada hari sidang.
 *
 * ============================================================================
 * DIAMBIL SAAT DISENTUH, BUKAN SAAT HALAMAN DIMUAT
 * ============================================================================
 *
 * Satu draf dapat memuat dua puluh rujukan. Memuat seluruh bunyinya di muka
 * berarti membuka draf menunggu dua puluh permintaan yang sebagian besarnya
 * tidak akan dibaca. Bunyinya diambil saat rujukannya ditekan, dan disimpan
 * selama halaman terbuka supaya penekanan kedua tidak meminta ulang.
 *
 * ============================================================================
 * YANG TIDAK DITEMUKAN BERKATA TIDAK DITEMUKAN
 * ============================================================================
 *
 * Rujukan yang jangkarnya tidak ada di pustaka menampilkan kekosongan yang
 * bertuliskan sebabnya, bukan diam. Justru rujukan itulah yang paling perlu
 * dilihat: ia yang menahan draf pada pemeriksaan J1, dan hakim yang melihatnya
 * di sini tahu apa yang harus dimuat sebelum dapat menandatangani.
 */

type Pasal = {
  jangkar: string;
  sebutan: string;
  judul: string;
  isi: string;
  peraturanJudul: string;
  peraturanNomor: string;
  peraturanTahun: number | null;
};

type Muatan = { keadaan: "memuat" | "ada" | "kosong" | "galat"; pasal?: Pasal; sebab?: string };

/** Bunyi pasal disimpan selama halaman terbuka - satu jangkar diminta sekali. */
const simpanan = new Map<string, Muatan>();

async function ambilPasal(jangkar: string): Promise<Muatan> {
  const tersimpan = simpanan.get(jangkar);
  if (tersimpan && tersimpan.keadaan !== "memuat") return tersimpan;

  try {
    const tanggapan = await fetch(apiPath(`/api/aleta-ecourt/pustaka/peraturan?jangkar=${encodeURIComponent(jangkar)}`));
    const isi = (await tanggapan.json()) as { ada?: boolean; bagian?: Pasal; sebab?: string };

    const hasil: Muatan = isi?.ada && isi.bagian
      ? { keadaan: "ada", pasal: isi.bagian }
      : {
          keadaan: "kosong",
          sebab:
            isi?.sebab ||
            "Pasal ini belum ada di pustaka hukum. Selama begitu, draf yang mengutipnya tidak dapat ditandatangani.",
        };
    simpanan.set(jangkar, hasil);
    return hasil;
  } catch {
    // TIDAK disimpan: gangguan jaringan bersifat sementara, dan menyimpannya
    // membuat rujukan ini gagal selamanya sampai halaman dimuat ulang.
    return { keadaan: "galat", sebab: "Pustaka hukum tidak terbaca. Coba lagi." };
  }
}

export function RujukanPasal({ jangkar, tertulis }: { jangkar: string; tertulis: string }) {
  const [terbuka, setTerbuka] = useState(false);
  const [muatan, setMuatan] = useState<Muatan | null>(null);

  const buka = useCallback(async () => {
    if (terbuka) {
      setTerbuka(false);
      return;
    }
    setTerbuka(true);
    if (!jangkar) {
      setMuatan({
        keadaan: "kosong",
        sebab: "Rujukan ini belum tersambung ke pustaka: peraturannya belum dikenali.",
      });
      return;
    }
    setMuatan({ keadaan: "memuat" });
    setMuatan(await ambilPasal(jangkar));
  }, [jangkar, terbuka]);

  return (
    <span className="inline">
      <button
        type="button"
        onClick={buka}
        aria-expanded={terbuka}
        className={
          "inline-flex items-baseline gap-1 rounded border-b border-dashed px-0.5 text-left " +
          (jangkar
            ? "border-emerald-500/70 text-emerald-800 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
            : "border-amber-500/70 text-amber-800 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/40")
        }
      >
        <BookOpen className="h-3 w-3 shrink-0 translate-y-0.5" aria-hidden />
        <span>{tertulis || jangkar}</span>
      </button>

      {terbuka ? (
        <span className="mt-2 block rounded-md border border-border bg-muted/40 p-3 text-sm">
          {muatan?.keadaan === "memuat" ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Membuka pasalnya…
            </span>
          ) : null}

          {muatan?.keadaan === "ada" && muatan.pasal ? (
            <span className="block">
              <span className="block text-xs font-medium text-muted-foreground">
                {muatan.pasal.peraturanJudul}
                {muatan.pasal.peraturanNomor ? ` Nomor ${muatan.pasal.peraturanNomor}` : ""}
                {muatan.pasal.peraturanTahun ? ` Tahun ${muatan.pasal.peraturanTahun}` : ""}
              </span>
              <span className="mt-1 block font-medium">{muatan.pasal.sebutan || muatan.pasal.judul}</span>
              <span className="mt-1.5 block whitespace-pre-wrap leading-relaxed">
                {muatan.pasal.isi || "Bunyi pasal ini belum terisi di pustaka."}
              </span>
              <span className="mt-2 block font-mono text-[11px] text-muted-foreground">{muatan.pasal.jangkar}</span>
            </span>
          ) : null}

          {muatan && (muatan.keadaan === "kosong" || muatan.keadaan === "galat") ? (
            <span className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{muatan.sebab}</span>
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
