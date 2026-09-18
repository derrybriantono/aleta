import { PageIntro } from "@/components/portal/shared";
import { SidangTunda } from "@/components/portal/sidang-tunda";

export const dynamic = "force-dynamic";

/**
 * Halaman penundaan sidang untuk panitera sidang.
 *
 * Pintunya kotak nomor perkara pada Antrian Sidang ALETA: yang memegang layar
 * itu sedang duduk di persidangan, dan yang ia butuhkan bukan menu melainkan
 * satu ketukan dari perkara yang sedang disidangkan ke tempat menuliskan
 * hasilnya.
 */
export default async function HalamanSidangTunda({
  params,
}: {
  params: Promise<{ jadwalId: string }>;
}) {
  const { jadwalId } = await params;
  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        eyebrow="ALETA e-Court"
        title="Tunda atau putus sidang"
        description="Menuliskan hasil sidang ke SIPP beserta audit trail-nya — penundaan sekaligus menandai antrian sidangnya selesai, atau putusan akhir beserta pertimbangan hukumnya. Rencananya selalu diperlihatkan lebih dahulu; tidak ada yang tertulis tanpa pernah dilihat."
      />
      <SidangTunda jadwalId={jadwalId} />
    </div>
  );
}
