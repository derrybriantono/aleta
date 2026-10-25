"use client";

import { PanelJaringan } from "@/components/portal/keamanan/panel-jaringan";
import { PanelSandi } from "@/components/portal/keamanan/panel-sandi";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePortal } from "@/lib/app-state";
import { bolehAksiLayar } from "@/lib/matriks-peran";

/**
 * Pengaturan Keamanan (Bagian 6, 25 Okt 2026): kebijakan sandi, batas jaringan
 * per peran, pengaman aksi admin, dan uji pulih cadangan. Semua saklar MATI bawaan.
 * Rute /api/admin/keamanan/* menegakkan hak (baca Admin, ubah Super Admin).
 */
export function PengaturanKeamananBoard() {
  const { currentUser } = usePortal();
  const bolehUbah = bolehAksiLayar(currentUser, "keamanan.atur");

  return (
    <Tabs defaultValue="sandi">
      <TabsList>
        <TabsTrigger value="sandi">Kebijakan sandi</TabsTrigger>
        <TabsTrigger value="jaringan">Batas jaringan</TabsTrigger>
      </TabsList>
      <TabsContent value="sandi">
        <PanelSandi bolehUbah={bolehUbah} />
      </TabsContent>
      <TabsContent value="jaringan">
        <PanelJaringan bolehUbah={bolehUbah} />
      </TabsContent>
    </Tabs>
  );
}
