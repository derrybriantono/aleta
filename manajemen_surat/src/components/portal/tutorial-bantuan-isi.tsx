"use client";

import Link from "next/link";
import { useMemo } from "react";

import { KartuTutorial } from "@/components/portal/tutorial-kartu";
import { usePortal } from "@/lib/app-state";
import { getEffectiveRoleId } from "@/lib/permissions";
import { TUTORIAL } from "@/lib/tutorial-isi";
import { saringTutorial, tutorialUntukHalaman } from "@/lib/tutorial-hidup";

const TANPA_VISIBILITAS: never[] = [];

/**
 * Isi panel bantuan "?" - dimuat hanya saat tombol ditekan, supaya data
 * tutorial dan catatan rilis tidak ikut membebani setiap halaman.
 */
export default function TutorialBantuanIsi({ jalur, tutupPanel }: { jalur: string; tutupPanel: () => void }) {
  const { currentUser, moduleVisibility: visibilitas } = usePortal();
  const moduleVisibility = visibilitas ?? TANPA_VISIBILITAS;

  const daftar = useMemo(() => {
    const roleId = getEffectiveRoleId(currentUser);
    const aksesMenu = moduleVisibility.find((item) => item.roleId === roleId) ?? null;
    return saringTutorial(tutorialUntukHalaman(TUTORIAL, jalur), { pengguna: currentUser, aksesMenu });
  }, [currentUser, moduleVisibility, jalur]);

  if (daftar.length === 0) {
    return (
      <div className="space-y-3 text-sm leading-6 text-muted-foreground">
        <p>Halaman ini belum punya langkah khusus untuk peran Anda.</p>
        <p>
          Anda tetap bisa mencari fitur lain di{" "}
          <Link href="/panduan" onClick={tutupPanel} className="font-medium text-primary underline-offset-4 hover:underline">
            halaman Tutorial
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm leading-6 text-muted-foreground">
        {daftar.length === 1 ? "Langkah untuk halaman ini:" : `${daftar.length} fitur di halaman ini. Tekan satu untuk membaca langkahnya:`}
      </p>
      {daftar.map((t) => (
        <KartuTutorial key={t.id} tutorial={t} ringkas tampilkanKelompok={false} bukaAwal={false} />
      ))}
    </div>
  );
}
