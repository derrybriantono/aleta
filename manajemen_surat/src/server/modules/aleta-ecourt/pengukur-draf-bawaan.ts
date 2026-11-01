import { teksDokumen } from "@/server/modules/aleta-ecourt/cocok-putusan";
import { panggilBotJadwalSidang } from "@/server/modules/aleta-ecourt/jadwal-sidang-gateway";
import { simpanUsulanMemori } from "@/server/modules/aleta-ai/proyek-kelola";
import { pasangPelabuhanMemori, type DepsPengukur, type PelabuhanMemoriProyek, type PutusanBot } from "@/server/modules/aleta-ecourt/pengukur-draf";
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

/**
 * Titik sambung memori proyek ALETA Ai (P3): usulan pengukur diteruskan Super Admin ke memori proyek kelola (0122),
 * di sana tetap berstatus "usulan" sampai disetujui. Dipasang saat modul ini dimuat (rute pengukur & detak memuatnya).
 */
export const PELABUHAN_MEMORI_BAWAAN: PelabuhanMemoriProyek = {
  daftarProyek: async (db) =>
    (await db.queryAll<{ id: string; nama: string; memori_aktif: number | string }>(
      `SELECT id, nama, memori_aktif FROM aleta_ai_proyek_kelola WHERE aktif = 1 ORDER BY nama`
    )).map((r) => ({ id: String(r.id), nama: String(r.nama ?? ""), memoriAktif: Number(r.memori_aktif) === 1 })),
  simpanUsulan: simpanUsulanMemori,
};

pasangPelabuhanMemori(PELABUHAN_MEMORI_BAWAAN);
