/**
 * ============================================================================
 * LAMPIRAN DAFTAR PARA PIHAK untuk sampul cetak awal (keputusan Derry 26 Okt, versi 6) - MURNI
 * ============================================================================
 *
 * Sampul memuat pihak I lengkap dan sampai MUAT nama per sisi (8 untuk perkara berlawanan, 12 untuk permohonan; turut tergugat tiga sebaris).
 * Yang melebihi itu dicetak di halaman kedua RTF yang sama: tabel NO | NAMA | KEDUDUKAN | ALAMAT per kelompok pihak. Halaman kedua HANYA ada
 * bila perlu; bagian lampiran disusun di lampiran-sampul.ts (baris tabel sungguhan, bukan kolom bergaris banyak ABT). Berkas ini memuat angka romawi,
 * hitungan pihak, saringan kiriman klien, dan penempelan bagian lampiran ke RTF utama.
 */

export const MUAT_PIHAK = { lawan: 8, permohonan: 12 } as const;
export const TURUT_SEBARIS = 3;

export type PihakLampiran = { sisi: 1 | 2 | 3 | 4; urutan: number; nama: string; alamat: string };
export type JumlahPihak = { p1: number; p2: number; p3: number; p4: number };

const ROMAWI_DASAR: Array<[number, string]> = [
  [1000, "M"],
  [900, "CM"],
  [500, "D"],
  [400, "CD"],
  [100, "C"],
  [90, "XC"],
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];
export function romawi(n: number): string {
  let sisa = Math.max(0, Math.trunc(n));
  let hasil = "";
  for (const [nilai, huruf] of ROMAWI_DASAR) {
    while (sisa >= nilai) {
      hasil += huruf;
      sisa -= nilai;
    }
  }
  return hasil;
}

/** Banyak pihak: tampilan sampul memakai varian "Pihak Banyak" (dua kolom nama bernomor romawi). */
export function pihakBanyak(j: JumlahPihak): boolean {
  return j.p1 > 1 || j.p2 > 1 || j.p3 > 0 || j.p4 > 0;
}

/** Lampiran halaman kedua diperlukan bila ada sisi yang melebihi muat sampul, pihak intervensi, atau turut tergugat lebih dari tiga. */
export function perluLampiran(j: JumlahPihak, lawan: boolean): boolean {
  const muat = lawan ? MUAT_PIHAK.lawan : MUAT_PIHAK.permohonan;
  return j.p1 > muat || j.p2 > muat || j.p3 > 0 || j.p4 > TURUT_SEBARIS;
}

export function jumlahDariDaftar(daftar: PihakLampiran[]): JumlahPihak {
  const h: JumlahPihak = { p1: 0, p2: 0, p3: 0, p4: 0 };
  for (const p of daftar) h[`p${p.sisi}` as keyof JumlahPihak] += 1;
  return h;
}

/** Menyaring kiriman klien menjadi daftar pihak aman (maksimum 500, teks dibatasi, tanpa kontrol RTF, tanpa nama aplikasi). */
export function bersihkanPihak(mentah: unknown): PihakLampiran[] {
  if (!Array.isArray(mentah)) return [];
  const hasil: PihakLampiran[] = [];
  for (const m of mentah.slice(0, 500)) {
    if (!m || typeof m !== "object") continue;
    const r = m as Record<string, unknown>;
    const sisi = Number(r.sisi);
    if (![1, 2, 3, 4].includes(sisi)) continue;
    const bersih = (x: unknown, maks: number) =>
      String(x ?? "")
        .replace(/[\u0000-\u001F]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, maks);
    const nama = bersih(r.nama, 200);
    if (!nama || /aleta/i.test(nama)) continue;
    hasil.push({ sisi: sisi as 1 | 2 | 3 | 4, urutan: Math.max(1, Math.min(9999, Math.trunc(Number(r.urutan)) || hasil.length + 1)), nama, alamat: /aleta/i.test(String(r.alamat ?? "")) ? "" : bersih(r.alamat, 250) });
  }
  return hasil;
}

/** Menempelkan bagian lampiran ke RTF utama (sebelum kurung tutup dokumen). RTF tanpa kurung tutup dikembalikan apa adanya. */
export function gabungLampiran(rtfUtama: string, bagian: string): string {
  const akhir = rtfUtama.lastIndexOf("}");
  if (akhir < 0 || !rtfUtama.startsWith("{\\rtf")) return rtfUtama;
  return `${rtfUtama.slice(0, akhir)}${bagian}}${rtfUtama.slice(akhir + 1)}`;
}
