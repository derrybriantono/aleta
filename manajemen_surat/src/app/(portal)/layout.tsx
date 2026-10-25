import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { PortalShellV2 } from "@/components/layout/portal-shell-v2";
import { GantiSandiWajib } from "@/components/portal/ganti-sandi-wajib";
import { JaringanDitolak } from "@/components/portal/jaringan-ditolak";
import { PengamanAksiGlobal } from "@/components/portal/keamanan/pengaman-aksi-global";
import { PenangkapGalat } from "@/components/portal/penangkap-galat";
import { HalamanPemeliharaan, PitaPemeliharaan, type KeadaanPublik } from "@/components/portal/pemeliharaan";
import { PitaKembaran } from "@/components/portal/pita-kembaran";
import { getAuth } from "@/lib/auth";
import { getDatabase } from "@/server/db/client";
import { periksaJaringanSesi } from "@/server/modules/keamanan/jaringan";
import { wajibGantiSandi } from "@/server/modules/keamanan/kebijakan-sandi";
import { bolehLewatPemeliharaan, keadaanPemeliharaan } from "@/server/modules/pemeliharaan/layanan";
import { getUserByIdFromDb } from "@/server/modules/organization/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await getAuth();
  const permintaanHeaders = await headers();
  const session = await auth.api.getSession({
    headers: permintaanHeaders,
  });

  if (!session?.user) {
    redirect("/login");
  }

  const db = await getDatabase();
  const actor = await getUserByIdFromDb(db, session.user.id);

  if (!actor?.isActive) {
    redirect("/login");
  }

  // Batas jaringan per peran (Bagian 6b): bawaan semua peran "mana pun" -> selalu lolos.
  const jaringan = await periksaJaringanSesi(db, {
    userId: session.user.id,
    sessionId: String(session.session?.id ?? ""),
    headers: permintaanHeaders,
  });
  if (!jaringan.lolos) return <JaringanDitolak pesan={jaringan.pesan} />;

  // Kebijakan sandi (Bagian 6a): mati bawaan; menyala -> akun yang dipaksa ganti atau sandinya kedaluwarsa menggantinya dulu.
  const gantiSandi = await wajibGantiSandi(db, session.user.id);
  if (gantiSandi.wajib && gantiSandi.alasan) {
    return <GantiSandiWajib alasan={gantiSandi.alasan} nama={actor.name} />;
  }

  // Mode pemeliharaan (E3): pengguna yang tidak dikecualikan melihat layar pemeliharaan. Gagal baca = portal biasa.
  let pemeliharaan: KeadaanPublik | null = null;
  let dikecualikan = false;
  let tutupPortal = false;
  try {
    const keadaan = await keadaanPemeliharaan(db);
    const { adminBoleh: _adminBoleh, ...publik } = keadaan;
    dikecualikan = bolehLewatPemeliharaan(actor.roleId, keadaan);
    if (keadaan.aktif || keadaan.menitSampaiMulai !== null) pemeliharaan = publik;
    tutupPortal = keadaan.aktif && !dikecualikan;
  } catch {
    /* tidak terbaca: portal berjalan seperti biasa */
  }
  if (tutupPortal && pemeliharaan) return <HalamanPemeliharaan awal={pemeliharaan} />;

  return (
    <>
      <PengamanAksiGlobal />
      <PitaKembaran />
      <PitaPemeliharaan awal={pemeliharaan} dikecualikan={dikecualikan} />
      <PenangkapGalat />
      <Suspense fallback={<div className="min-h-screen bg-background" />}>
        <PortalShellV2>{children}</PortalShellV2>
      </Suspense>
    </>
  );
}
