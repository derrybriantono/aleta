import type { HasilIsiGugatan, OpsiOtomatisBerkas } from "@/server/modules/aleta-ecourt/isi-gugatan";
import type { bacaGugatanEcourt } from "@/server/modules/aleta-ecourt/isi-sipp-sumber";

/**
 * Pembaca berkas e-Court dengan singgahan 30 menit per perkara - dipakai rute isi-gugatan dan bukti-saksi (G2) supaya PDF/OCR yang
 * sama tidak dibaca dua kali. Kunci singgahan memuat sebutan, majelis, bukti, dan SAKLAR isi otomatis: mengubah saklar langsung berlaku.
 *
 * Pembacanya DISUNTIKKAN pemanggil (bacaGugatanEcourt dari isi-sipp-sumber): rute isi-gugatan, kuasa-gugatan, bukti-saksi, dan agen draf
 * putusan tetap membaca lewat SATU pembaca yang sama (dijaga draf-h7-mulus-19okt), dan uji dapat menggantinya.
 */
const SINGGAH_MS = 30 * 60 * 1000;
const singgah = new Map<string, { sampai: number; hasil: HasilIsiGugatan }>();

export function buangSinggahanIsiGugatan() {
  singgah.clear();
}

export async function bacaGugatanSinggah(
  nomor: string,
  sebutan: { lawan: string; pelaku: string },
  majelis: string | undefined,
  opsi: { denganBukti: boolean; otomatis: OpsiOtomatisBerkas; ulang?: boolean },
  baca: typeof bacaGugatanEcourt
): Promise<{ hasil: HasilIsiGugatan; dariSinggahan: boolean }> {
  const kunci = `${nomor}|${sebutan.lawan}|${sebutan.pelaku}|${majelis || ""}|${opsi.denganBukti ? "bukti" : ""}|${opsi.otomatis.bukti ? "ob" : ""}${opsi.otomatis.kesimpulan ? "ok" : ""}`;
  const lama = singgah.get(kunci);
  if (!opsi.ulang && lama && lama.sampai > Date.now()) return { hasil: lama.hasil, dariSinggahan: true };
  const hasil = await baca(nomor, sebutan, majelis, { denganBukti: opsi.denganBukti, otomatis: opsi.otomatis });
  singgah.set(kunci, { sampai: Date.now() + SINGGAH_MS, hasil });
  if (singgah.size > 300) {
    for (const [k, v] of singgah) if (v.sampai <= Date.now()) singgah.delete(k);
  }
  return { hasil, dariSinggahan: false };
}
