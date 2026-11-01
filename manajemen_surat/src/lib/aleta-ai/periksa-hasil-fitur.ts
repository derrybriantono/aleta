import type { DrafPutusanA1 } from "@/lib/draf-putusan-a1";
import { periksaHasilAiA1, type PemeriksaAiA1 } from "@/lib/draf-putusan-a1-ai";
import { LABEL_STATUS, type HasilPenilaian, type StatusPembuktian } from "@/lib/penilai-bukti";
import { uraiUsulanAi } from "@/lib/penilai-bukti-ai";

/**
 * ============================================================================
 * PEMERIKSA HASIL FITUR BANTU C5 & C6 (1 Nov 2026, G3) - RAK PERATURAN SESUDAH AI MENJAWAB
 * ============================================================================
 *
 * C1-C4 sudah diperiksa lewat POST draf-putusan-a1 (perlu draf A1 perkara). Dua fitur lain yang menyebut pasal:
 *   C5  saran pasal     -> tiap rujukan yang TIDAK terverifikasi di rak diberi "[PERLU VERIFIKASI]" tepat sesudahnya,
 *                          bunyi pasal yang dikutip diperiksa terhadap rak (pemeriksa yang sama dengan A1, tanpa draf).
 *   C6  penilaian lanjutan (A2) -> jawaban JSON diurai uraiUsulanAi: hanya id dalil yang ada di tabel, hanya 4 status sah,
 *                          pasal hanya yang terverifikasi (saringSaranAi); lainnya dibuang dan disebut di catatan.
 * Murni: pemeriksa rak disuntik (server memakai bolehDisarankan + periksaNaskah). Hasil tetap USULAN.
 */

export type HasilPeriksaFitur = { teks: string; catatan: string[] };

/** Baris tabel penilaian yang dikirim panel (cukup id, status aturan, nomor, ringkas). */
export type BarisRingkasPenilaian = { id: string; status: StatusPembuktian; nomor?: string; ringkas?: string };

const STATUS_SAH = new Set<string>(Object.keys(LABEL_STATUS));
const DRAF_KOSONG = { dalil: [] } as unknown as DrafPutusanA1;

export function periksaHasilC5(teks: string, periksa: PemeriksaAiA1): HasilPeriksaFitur {
  const h = periksaHasilAiA1(teks, DRAF_KOSONG, periksa);
  const catatan: string[] = [];
  if (h.pasalDitandai.length) catatan.push(`${h.pasalDitandai.length} rujukan belum terverifikasi di rak peraturan dan diberi tanda [PERLU VERIFIKASI].`);
  for (const k of h.temuanKutipan.slice(0, 10)) catatan.push(`Bunyi ${k.rujukan}: ${k.pesan}`);
  return { teks: h.teks, catatan };
}

export function bersihBarisPenilaian(x: unknown): BarisRingkasPenilaian[] {
  if (!Array.isArray(x)) return [];
  const hasil: BarisRingkasPenilaian[] = [];
  for (const r of x.slice(0, 200)) {
    const o = (r || {}) as Record<string, unknown>;
    const id = String(o.id ?? "").trim().slice(0, 80);
    const status = String(o.status ?? "").trim();
    if (!id || !STATUS_SAH.has(status)) continue;
    hasil.push({ id, status: status as StatusPembuktian, nomor: String(o.nomor ?? "").slice(0, 20), ringkas: String(o.ringkas ?? "").replace(/\s+/g, " ").trim().slice(0, 200) });
  }
  return hasil;
}

export function periksaHasilC6(jawaban: string, baris: readonly BarisRingkasPenilaian[]): HasilPeriksaFitur {
  if (!baris.length) return { teks: "", catatan: ["Tabel penilaian pembuktian belum terbaca; buka bagian Penilaian pembuktian lalu jalankan lagi."] };
  const tabel = { baris } as unknown as HasilPenilaian;
  const usulan = uraiUsulanAi(jawaban, tabel);
  const per = new Map(baris.map((r) => [r.id, r]));
  const catatan: string[] = [];
  if (!/\[[\s\S]*\]/.test(String(jawaban ?? ""))) catatan.push("Jawaban tidak berbentuk daftar; tidak ada usulan yang dapat dibaca.");
  const ditolak = usulan.flatMap((u) => u.pasalDitolak);
  if (ditolak.length) catatan.push(`${ditolak.length} rujukan pasal dibuang karena belum terverifikasi di rak peraturan: ${ditolak.map((d) => d.teks).slice(0, 6).join("; ")}.`);
  if (!usulan.length) return { teks: "Tidak ada usulan perubahan: status penilaian aturan dinilai sudah tepat.", catatan };
  const teks = usulan
    .map((u) => {
      const r = per.get(u.id);
      const judul = `Dalil ${r?.nomor || u.id}${r?.ringkas ? ` (${r.ringkas})` : ""}`;
      const status = u.berubah ? `status aturan ${LABEL_STATUS[u.statusAturan]} -> usulan ${LABEL_STATUS[u.status]}` : `status ${LABEL_STATUS[u.status]} (tetap)`;
      const alasan = u.alasan ? ` ${u.alasan.replace(/[.;,]?$/, ".")}` : "";
      return `${judul}: ${status}.${alasan}${u.pasal.length ? ` Dasar: ${u.pasal.join("; ")}.` : ""}`;
    })
    .join("\n");
  return { teks, catatan };
}
