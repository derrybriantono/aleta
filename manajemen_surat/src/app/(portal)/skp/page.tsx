import { PageIntro } from "@/components/portal/shared";
import { SkpHalaman } from "@/components/portal/skp-halaman";

export const dynamic = "force-dynamic";

/**
 * SKP pegawai: realisasi bulanan, triwulan, dan tahunan yang dibaca dari SIPP,
 * dilengkapi isian sendiri bila SIPP tidak mencatatnya. Tab yang tampil
 * mengikuti hak orang yang membukanya.
 */
export default function HalamanSkp() {
  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        eyebrow="Kinerja pegawai"
        title="SKP"
        description="Sasaran Kinerja Pegawai per bulan, triwulan, dan tahun. Angkanya dibaca dari SIPP; yang tidak tercatat di SIPP diisi sendiri lengkap dengan bukti, lalu diajukan ke atasan."
      />
      <SkpHalaman />
    </div>
  );
}
