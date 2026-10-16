import { getGatewayKehadiranRinci, type KehadiranBaris } from "@/server/modules/aleta-bot/whatsapp-gateway-client";

/**
 * F3.2 (17 Okt 2026): kehadiran rinci per orang untuk SATU sidang.
 *
 * Dipakai rute yang menyusun blangko Tunda/Putus, BAS, dan jendela ekstensi
 * di SIPP. null = tidak terbaca (bot lama/mati, tanggal tidak sah) - BUKAN
 * "tidak ada yang hadir"; pemanggil membiarkan usulan lain berlaku.
 */
export async function bacaKehadiranSidang(
  perkaraId: string | number | null | undefined,
  tanggalSidang: string | null | undefined
): Promise<KehadiranBaris[] | null> {
  const id = String(perkaraId ?? "").trim();
  const tanggal = String(tanggalSidang ?? "").slice(0, 10);
  if (!/^\d+$/.test(id) || !/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return null;
  try {
    const hasil = await getGatewayKehadiranRinci({ perkaraId: [id], tanggal });
    if (!hasil.ok || !hasil.data?.kehadiran) return null;
    return hasil.data.kehadiran[id]?.hadir ?? [];
  } catch {
    return null;
  }
}
