import { teksDokumen } from "@/server/modules/aleta-ecourt/cocok-putusan";
import { panggilBotJadwalSidang } from "@/server/modules/aleta-ecourt/jadwal-sidang-gateway";
import type { DepsPengukur, PutusanBot } from "@/server/modules/aleta-ecourt/pengukur-draf";
import { ambilBerkasSippGateway } from "@/server/modules/aleta-bot/whatsapp-gateway-client";

/**
 * Sumber bawaan pengukur draf (P3): bahan putusan dari bot (satu panggilan untuk banyak perkara, hanya SELECT) dan,
 * sebagai cadangan, teks dokumen putusan lewat jalur berkas SIPP yang sama dengan "cocok putusan".
 * Dipisah dari pengukur-draf.ts supaya aturan dan penyimpanannya dapat diuji tanpa bot.
 */
export const DEPS_PENGUKUR_BAWAAN: DepsPengukur = {
  bahan: async (ids) => {
    const h = await panggilBotJadwalSidang<{ ok?: boolean; alasan?: string; perkara?: PutusanBot[] }>(`/putusan-akhir?perkaraId=${encodeURIComponent(ids.join(","))}`, { timeoutMs: 30_000 });
    if (!h.ok) return { ok: false, error: h.error };
    if (!h.data.ok) return { ok: false, error: String(h.data.alasan || "Bahan putusan tidak terbaca.") };
    return { ok: true, perkara: Array.isArray(h.data.perkara) ? h.data.perkara : [] };
  },
  dokumen: async (perkaraId) => {
    const pembatal = new AbortController();
    const pewaktu = setTimeout(() => pembatal.abort(), 20_000);
    try {
      const r = await ambilBerkasSippGateway("putusan", perkaraId, pembatal.signal);
      if (!r.ok) return null;
      const bita = new Uint8Array(await r.arrayBuffer());
      if (!bita.length || bita.length > 20 * 1024 * 1024) return null;
      return await teksDokumen(bita, "putusan.pdf");
    } catch {
      return null;
    } finally {
      clearTimeout(pewaktu);
    }
  },
};
