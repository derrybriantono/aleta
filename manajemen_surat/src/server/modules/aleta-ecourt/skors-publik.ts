import { panggilBotJadwalSidang } from "@/server/modules/aleta-ecourt/jadwal-sidang-gateway";
import { kalimatPublikSkors, skorsPublikBerlaku, type SkorsTercatat } from "@/lib/skors-sidang";

/**
 * Skors yang MASIH BERLAKU hari ini, per perkara - bahan layar tanpa login
 * (layar antrian /antrian-tampil, papan pintu /sidang-ruang). F3.1.
 *
 * Hanya membaca tabel ALETA lewat bot (GET /skors). Gagal membaca = peta
 * kosong: layar tetap jalan seperti sebelum F3.1, tidak ada yang "diskors"
 * karena tebakan.
 */
export async function bacaSkorsBerlakuHariIni(tanggal: string): Promise<Map<string, SkorsTercatat>> {
  const peta = new Map<string, SkorsTercatat>();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return peta;
  try {
    const hasil = await panggilBotJadwalSidang<{ ok?: boolean; skors?: SkorsTercatat[] }>(
      `/skors?${new URLSearchParams({ dari: tanggal, sampai: tanggal }).toString()}`,
      { timeoutMs: 4000 }
    );
    if (!hasil.ok || !Array.isArray(hasil.data.skors)) return peta;
    // Terlama dulu dari bot - yang terakhir menang bila ada dua yang berlaku.
    for (const s of hasil.data.skors) {
      if (!s || String(s.dilanjutkanPada || "").trim()) continue;
      peta.set(String(s.perkaraId), s);
    }
  } catch {
    // Diam: layar umum tidak menceritakan galat dalamnya.
  }
  return peta;
}

/**
 * Keterangan skors untuk SATU perkara di layar umum - "" bila tidak diskors
 * (atau sudah dipanggil lagi sesudah diskors). Hanya jam perkiraan; alasan
 * dan nama petugas tidak pernah keluar ke layar tanpa login.
 */
export function keteranganSkorsPublik(
  peta: Map<string, SkorsTercatat>,
  perkaraId: string,
  jamPanggil?: string | null
): string {
  const s = peta.get(String(perkaraId));
  if (!s || !skorsPublikBerlaku(s, jamPanggil)) return "";
  return kalimatPublikSkors(s.perkiraanLanjut);
}
