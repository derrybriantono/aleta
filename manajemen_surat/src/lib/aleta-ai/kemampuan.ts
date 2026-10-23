/**
 * ALETA Ai tahap 2a - KEMAMPUAN APA yang diminta satu giliran (murni).
 *
 * Matriks kemampuan per peran (rencana v2 bagian 10.3) ada di
 * lib/matriks-peran.ts (KEMAMPUAN_AI). Berkas ini hanya MENGENALI permintaan:
 *   - kelompok rute draf putusan -> "draf-putusan" (pasti, dari tabel rute);
 *   - permintaan MEMBUAT (buat/susun/draf/tuliskan/...) + jenis naskah
 *     (penetapan PMH/PHS/PPP/PJS, BAS, surat dinas, laporan kinerja, rekap
 *     kasir) -> kemampuan itu.
 * Pertanyaan "apa itu penetapan PMH?" BUKAN permintaan membuat, jadi tidak
 * ditolak. Data perkara/rekap dijaga terpisah lewat alat (AKSES_DATA_AI).
 */

import type { KemampuanAi } from "@/lib/matriks-peran";
import { KELOMPOK_PUTUSAN } from "@/lib/aleta-ai/rute";

export type PermintaanKemampuan = { kemampuan: KemampuanAi; jenisPenetapan?: string };

const KATA_BUAT = /\b(buat|buatkan|bikin|bikinkan|susun|susunkan|draf|drafkan|draft|tulis|tuliskan|rancang|rancangkan|siapkan|konsep|konsepkan)\b/i;

const POLA: ReadonlyArray<[RegExp, KemampuanAi]> = [
  [/\b(putusan|pertimbangan hukum|amar)\b/i, "draf-putusan"],
  [/\b(penetapan|pmh|phs|ppp|pjs)\b/i, "draf-penetapan"],
  [/\b(bas|berita acara sidang|ringkasan sidang)\b/i, "draf-bas"],
  [/\b(relaas|surat panggilan|analisa panggilan)\b/i, "relaas"],
  [/\b(surat dinas|nota dinas|surat tugas|laporan kepegawaian|surat keputusan)\b/i, "surat-dinas"],
  [/\b(laporan (statistik|kinerja|bulanan|tahunan)|skp|lkjip)\b/i, "laporan-kinerja"],
  [/\b(rekap (kasir|panjar|keuangan)|jurnal keuangan|laporan keuangan perkara)\b/i, "rekap-kasir"],
];

export function kemampuanDiminta(teks: string, kelompok: string): PermintaanKemampuan[] {
  const hasil: PermintaanKemampuan[] = [];
  if (kelompok === KELOMPOK_PUTUSAN) hasil.push({ kemampuan: "draf-putusan" });
  const t = String(teks ?? "");
  if (!KATA_BUAT.test(t)) return hasil;
  for (const [pola, kemampuan] of POLA) {
    if (!pola.test(t) || hasil.some((h) => h.kemampuan === kemampuan)) continue;
    if (kemampuan === "draf-penetapan") {
      const jenis = /\b(pmh|phs|ppp|pjs)\b/i.exec(t)?.[1]?.toUpperCase();
      hasil.push(jenis ? { kemampuan, jenisPenetapan: jenis } : { kemampuan });
    } else {
      hasil.push({ kemampuan });
    }
  }
  return hasil;
}
