"use client";

import { AletaAntrianPublikPengaturan } from "@/components/portal/aleta-antrian-publik-pengaturan";
import { AletaTautanJadwalPengaturan } from "@/components/portal/aleta-tautan-jadwal-pengaturan";
import { PublicAccessPanel } from "@/components/portal/public-access-panel";
import { getEffectiveRoleId } from "@/lib/permissions";
import { usePortal } from "@/lib/app-state";

/**
 * Dua hal yang sama-sama tentang "apa yang terlihat dari luar", dan karena itu
 * berdampingan:
 *
 *   - alamat publik portal (yang sudah lama ada)
 *   - layar antrian sidang yang dapat dibuka tanpa login, beserta ruas mana
 *     yang boleh tampil di sana (diminta pengguna 23 September 2026)
 *
 * Yang kedua menentukan apa yang dapat dibaca orang di LUAR portal, termasuk
 * nomor perkara dan nama para pihak bila ruasnya dinyalakan. Menaruhnya di
 * halaman ini membuat keduanya dibaca dalam satu tarikan napas, bukan
 * ditemukan terpisah oleh orang yang berbeda.
 */
export default function AdminPublicAccessPage() {
  const { currentUser } = usePortal();
  const peran = getEffectiveRoleId(currentUser);
  const bolehUbah = peran === "super-admin" || peran === "admin";

  return (
    <div className="flex flex-col gap-6">
      <PublicAccessPanel />
      <AletaAntrianPublikPengaturan bolehUbah={bolehUbah} />
      <AletaTautanJadwalPengaturan bolehUbah={bolehUbah} />
    </div>
  );
}
