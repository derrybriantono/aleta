import { apiPath } from "@/lib/base-path";

/**
 * Tanda berumur pendek untuk layar ALETA ABT (Tahap 5, keputusan 206) - sisi layar.
 * Bila ekstensi ALETA terpasang di peramban (skrip jembatannya memasang <html data-aleta-ekstensi="versi">), layar meminta tanda ke
 * /api/aleta-abt/tanda lalu menyertakannya pada setiap permintaan simpan/cetak. Tanpa ekstensi (HP) tidak ada tanda dan server memakai
 * hak ALETA ABT di HP. Tanda bukan kunci keamanan; penentu utamanya akun Super Admin di server.
 */
export const KEPALA_TANDA = "x-aleta-abt-tanda";

let simpanan: { tanda: string; sampai: number } | null = null;
let sedangMeminta: Promise<string> | null = null;

export function versiEkstensiTerbaca(): string {
  try {
    return String(document.documentElement.dataset.aletaEkstensi ?? "").trim();
  } catch {
    return "";
  }
}

async function mintaTanda(versi: string): Promise<string> {
  try {
    const r = await fetch(apiPath(`/api/aleta-abt/tanda?ekstensi=${encodeURIComponent(versi)}`), { cache: "no-store" });
    const j = (await r.json().catch(() => null)) as { ok?: boolean; data?: { tanda?: string; berlakuSampai?: number } } | null;
    if (!r.ok || !j?.data?.tanda) return "";
    simpanan = { tanda: j.data.tanda, sampai: Number(j.data.berlakuSampai) || Date.now() + 5 * 60_000 };
    return simpanan.tanda;
  } catch {
    return "";
  }
}

/** Kepala permintaan: berisi tanda bila ekstensi terbaca dan tanda berhasil diminta; selain itu kosong (server memakai hak HP). */
export async function kepalaTanda(): Promise<Record<string, string>> {
  const versi = versiEkstensiTerbaca();
  if (!versi) return {};
  if (simpanan && simpanan.sampai - Date.now() > 60_000) return { [KEPALA_TANDA]: simpanan.tanda };
  sedangMeminta = sedangMeminta ?? mintaTanda(versi).finally(() => (sedangMeminta = null));
  const t = await sedangMeminta;
  return t ? { [KEPALA_TANDA]: t } : {};
}

export function lupakanTanda() {
  simpanan = null;
}
