import { AletaSebaranJurusita } from "@/components/portal/aleta-sebaran-jurusita";
import { PageIntro } from "@/components/portal/shared";
import { PetaPerkara } from "@/components/portal/peta-perkara";

export const dynamic = "force-dynamic";

/**
 * Peta perkara.
 *
 * Menjawab pertanyaan yang tidak dapat dijawab daftar perkara: desa mana yang
 * paling banyak berperkara, faktor apa yang paling sering disebut, dan siapa
 * yang lebih sering datang ke pengadilan.
 */
export default function HalamanPetaPerkara() {
  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        eyebrow="ALETA e-Court"
        title="Peta perkara"
        description="Sebaran perkara dari provinsi sampai desa, faktor perceraian, dan siapa yang mengajukan. Bagian perkara yang alamatnya belum tercatat disebutkan apa adanya — sebaran dari sebagian data tidak boleh terbaca sebagai sebaran seluruhnya."
      />
      <PetaPerkara />
      {/* Pertanyaan yang berlawanan arah dengan petanya, dan dibaca orang
          yang berbeda: peta menjawab "siapa yang melayani desa ini", daftar
          ini menjawab "orang ini mengerjakan apa saja". Ditaruh di halaman
          yang sama sebab keduanya berdiri di atas sambungan nama yang sama -
          dan bila sambungan itu salah, keduanya salah bersama. */}
      <AletaSebaranJurusita periode="tahun" />
    </div>
  );
}
