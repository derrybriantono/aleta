"use client";

import { penandaJawabanBaris, type BarisPenandaJawaban } from "@/lib/penanda-jawaban";
import { cn } from "@/lib/utils";

/**
 * Penanda "eksepsi" / "rekonvensi" di kolom Agenda Jadwal Sidang (butir 4,
 * 6 Okt 2026) - dibaca dari jawaban dan duplik Tergugat/Termohon. Title
 * menyebut dokumen sumbernya dan kalimat pemicunya; ditekan = membuka Status
 * Perkara. Tidak ada / tidak terbaca = tidak digambar sama sekali. Lihat
 * lib/penanda-jawaban.ts.
 *
 * Berkas sendiri, bukan di aleta-ecourt-sidang.tsx: layar itu hanya memasang
 * satu elemen di kolom Agenda.
 */
export function PenandaJawabanAgenda({
  baris,
  onBuka,
}: {
  baris: BarisPenandaJawaban;
  onBuka?: () => void;
}) {
  const penanda = penandaJawabanBaris(baris);
  if (penanda.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {penanda.map((p) => (
        <button
          key={p.kunci}
          type="button"
          data-penanda-jawaban={p.kunci}
          onClick={onBuka}
          disabled={!onBuka}
          className={cn(
            "whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold disabled:cursor-default",
            p.kelas
          )}
          title={p.keterangan}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
