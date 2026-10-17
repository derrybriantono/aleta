import { Laptop } from "lucide-react";
import Link from "next/link";

import { bacaCapTarik, kalimatPita, modeKembaran } from "@/server/modules/sinkron/kembaran";

/**
 * Pita "Mode kembaran - data per <waktu>" di puncak setiap halaman portal.
 *
 * Komponen server: dirender di server portal laptop dan tidak ada sama sekali
 * (null) di portal server kantor. Waktunya = saat DATA dibuat di server (cap
 * tarikan terakhir), bukan saat ini - petugas harus tahu seberapa basi data
 * yang sedang dilihat dan bahwa tulisan ke SIPP/ABT hanya ditahan di antrean.
 */
export async function PitaKembaran() {
  if (!modeKembaran()) return null;
  const cap = await bacaCapTarik();
  return (
    <div
      role="status"
      data-pita-kembaran=""
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-amber-400 bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100 sm:text-sm"
    >
      <Laptop className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="font-semibold">{kalimatPita(cap)}</span>
      <span className="min-w-0 flex-1 font-normal">
        Perubahan ke SIPP dan ABT ditahan di antrean sampai disinkronkan ke server. WhatsApp dan e-Court mati.
      </span>
      <Link href="/admin/sinkron-kembaran" className="whitespace-nowrap underline underline-offset-2 hover:no-underline">
        Sinkron kembaran
      </Link>
    </div>
  );
}
