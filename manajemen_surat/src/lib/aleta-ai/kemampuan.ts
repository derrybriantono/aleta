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

const KATA_BUAT = "buat|buatkan|bikin|bikinkan|susun|susunkan|draf|drafkan|draft|tulis|tuliskan|rancang|rancangkan|siapkan|konsep|konsepkan";
/** Kata di antara kata kerja dan naskah yang TIDAK menjadikannya draf ("buatkan ringkasan putusan" = ringkas, bukan draf). */
const BUKAN_DRAF = /\b(ringkas|ringkasan|rangkum|rangkuman|analisa|analisis|telaah|kajian|catatan|daftar|rekap|jadwal|tabel)\b/i;

const NASKAH: ReadonlyArray<[string, KemampuanAi]> = [
  ["putusan|pertimbangan hukum|pertimbangan|amar", "draf-putusan"],
  ["penetapan|pmh|phs|ppp|pjs", "draf-penetapan"],
  ["bas|berita acara sidang|ringkasan sidang", "draf-bas"],
  ["relaas|surat panggilan|analisa panggilan", "relaas"],
  ["surat dinas|nota dinas|surat tugas|laporan kepegawaian|surat keputusan", "surat-dinas"],
  ["laporan statistik|laporan kinerja|laporan bulanan|laporan tahunan|skp|lkjip", "laporan-kinerja"],
  ["rekap kasir|rekap panjar|rekap keuangan|jurnal keuangan|laporan keuangan perkara", "rekap-kasir"],
];

/** Kata kerja membuat, lalu paling banyak dua kata (draf/naskah/konsep ...), lalu jenis naskahnya. */
function polaBuat(naskah: string) {
  return new RegExp(`\\b(?:${KATA_BUAT})\\b((?:\\s+[\\p{L}\\d/.-]+){0,2}?)\\s+(?:${naskah})\\b`, "iu");
}

export function kemampuanDiminta(teks: string, kelompok: string): PermintaanKemampuan[] {
  const hasil: PermintaanKemampuan[] = [];
  if (kelompok === KELOMPOK_PUTUSAN) hasil.push({ kemampuan: "draf-putusan" });
  const t = String(teks ?? "");
  for (const [naskah, kemampuan] of NASKAH) {
    if (hasil.some((h) => h.kemampuan === kemampuan)) continue;
    const m = polaBuat(naskah).exec(t);
    // "ringkasan sidang" sendiri adalah naskah draf-bas; kata sela lain menandai bukan draf.
    if (!m || (kemampuan !== "draf-bas" && BUKAN_DRAF.test(m[1] ?? ""))) continue;
    if (kemampuan === "draf-penetapan") {
      const jenis = /\b(pmh|phs|ppp|pjs)\b/i.exec(t)?.[1]?.toUpperCase();
      hasil.push(jenis ? { kemampuan, jenisPenetapan: jenis } : { kemampuan });
    } else {
      hasil.push({ kemampuan });
    }
  }
  return hasil;
}
