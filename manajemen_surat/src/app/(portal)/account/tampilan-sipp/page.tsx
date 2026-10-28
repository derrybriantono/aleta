"use client";

import { TampilanSippSaya } from "@/components/portal/tampilan-sipp-saya";
import { EmptyState, PageIntro } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";

/** Pengaturan tampilan ALETA di halaman SIPP milik pengguna sendiri (28 Okt 2026) - dibuka dari widget dan popup ekstensi. */
export default function TampilanSippSayaPage() {
  const { currentUser } = usePortal();
  if (!currentUser) return <EmptyState title="Akun tidak tersedia" description="Silakan masuk ulang untuk mengatur tampilan SIPP." />;
  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Akun Saya"
        title="Tampilan ALETA di SIPP"
        description="Pilih bagian ALETA yang tampil di halaman SIPP. Tersimpan otomatis di akun Anda."
      />
      <TampilanSippSaya />
    </div>
  );
}
