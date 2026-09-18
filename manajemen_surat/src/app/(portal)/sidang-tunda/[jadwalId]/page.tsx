import { PageIntro } from "@/components/portal/shared";
import { HasilSidang } from "@/components/portal/hasil-sidang";

export const dynamic = "force-dynamic";

/**
 * Halaman hasil sidang untuk panitera sidang.
 *
 * Pintunya kotak nomor perkara pada Antrian Sidang ALETA: yang memegang layar
 * itu sedang duduk di persidangan, dan yang ia butuhkan bukan menu melainkan
 * satu ketukan dari perkara yang sedang disidangkan ke tempat menuliskan
 * hasilnya.
 *
 * Alamatnya tetap /sidang-tunda meski isinya kini tunda DAN putus. Alamat itu
 * sudah tertanam pada layar antrian dan pada tautan yang mungkin sudah dibuka
 * orang; menggantinya demi kerapian nama menukar satu ketidaknyamanan dengan
 * tautan yang mati.
 */
export default async function HalamanHasilSidang({
  params,
}: {
  params: Promise<{ jadwalId: string }>;
}) {
  const { jadwalId } = await params;
  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        eyebrow="ALETA e-Court"
        title="Hasil sidang"
        description="Ditunda atau diputus — satu pilihan, sebab sidang tidak dapat keduanya sekaligus. Yang tertulis ke SIPP beserta audit trail-nya atas nama panitera sidang perkara ini, dan rencananya selalu diperlihatkan lebih dahulu; tidak ada yang tertulis tanpa pernah dilihat."
      />
      <HasilSidang jadwalId={jadwalId} />
    </div>
  );
}
