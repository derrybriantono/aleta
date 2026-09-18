import { PageIntro } from "@/components/portal/shared";
import { BebanKonseptor } from "@/components/portal/beban-konseptor";

export const dynamic = "force-dynamic";

/**
 * Beban kinerja konseptor putusan.
 *
 * Terpisah dari layar Statistik dengan sengaja: statistik menghitung PERKARA,
 * layar ini menghitung ORANG. Dua hal yang tampak mirip di layar tetapi tidak
 * sama sekali mirip akibatnya bila angkanya keliru.
 */
export default function HalamanBebanKonseptor() {
  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        eyebrow="ALETA e-Court"
        title="Beban kinerja konseptor"
        description="Bukan berapa banyak putusan, melainkan seberapa berat - verstek atau contradictoir, status putusannya, rekonvensi, putusan sela, saksi, jumlah sidang, dan panjang naskah pertimbangannya. Angka mentahnya selalu ikut, dan tiap perkara dapat dibuka rinciannya."
      />
      <BebanKonseptor />
    </div>
  );
}
