/**
 * Tautan otomatis berkas tanda tangan BERNAMA ke akun pemiliknya (14 Okt 2026).
 * Aturan cocoknya di lib/tautan-ttd-akun.ts (murni); di sini hanya alurnya:
 * pratinjau (tidak menulis apa pun) dan penerapan (hanya baris "pasti" yang
 * dipilih, dihitung ULANG dari data terkini - bukan dari pratinjau peramban).
 */

import {
  akunPastiUntukNama,
  cocokkanTtdKeAkun,
  ringkasTtd,
  type AkunTtd,
  type BerkasTtdRingkas,
  type HasilTtd,
} from "@/lib/tautan-ttd-akun";

export type DepsTautanTtd = {
  daftarBerkas: () => Promise<BerkasTtdRingkas[]>;
  daftarAkun: () => Promise<AkunTtd[]>;
  tulisTautan: (
    id: number,
    p: { penggunaId: string; peran: string; subPeran: string; namaPejabat: string }
  ) => Promise<{ ok: boolean; alasan?: string }>;
};

export type HasilTerapTtd = { id: number; ok: boolean; alasan: string; penggunaId: string; namaAkun: string };

export async function tautkanTtdOtomatis(
  deps: DepsTautanTtd,
  pilihan: { terapkan: boolean; ids?: number[] }
): Promise<{ hasil: HasilTtd[]; ringkasan: ReturnType<typeof ringkasTtd>; diterapkan: HasilTerapTtd[] }> {
  const [berkas, akun] = await Promise.all([deps.daftarBerkas(), deps.daftarAkun()]);
  const hasil = cocokkanTtdKeAkun(berkas, akun);
  const diterapkan: HasilTerapTtd[] = [];
  if (pilihan.terapkan) {
    const dipilih = pilihan.ids ? new Set(pilihan.ids.map(Number)) : null;
    for (const h of hasil) {
      if (h.kelompok !== "pasti" || !h.akun) continue;
      if (dipilih && !dipilih.has(h.id)) continue;
      const jawab = await deps.tulisTautan(h.id, {
        penggunaId: h.akun.id,
        peran: h.akun.peran,
        subPeran: h.akun.subPeran,
        namaPejabat: h.namaPejabat,
      });
      diterapkan.push({ id: h.id, ok: jawab.ok, alasan: jawab.alasan ?? "", penggunaId: h.akun.id, namaAkun: h.akun.nama });
    }
  }
  return { hasil, ringkasan: ringkasTtd(hasil), diterapkan };
}

/**
 * Saat berkas tanda tangan BARU diunggah tanpa akun dipilih: bila namanya sama
 * persis dengan TEPAT SATU akun aktif, akun itu dipakai. Ganda/tidak ketemu =
 * dibiarkan tanpa tautan (seperti sebelumnya).
 */
export function tautanSaatUnggah(
  masukan: { namaPejabat: string; penggunaId: string },
  akun: AkunTtd[]
): { penggunaId: string; peran: string; subPeran: string; otomatis: boolean; namaAkun: string } | null {
  if (masukan.penggunaId.trim()) return null;
  const jawab = akunPastiUntukNama(masukan.namaPejabat, akun);
  if (jawab.jenis !== "pasti") return null;
  return { penggunaId: jawab.akun.id, peran: jawab.akun.peran, subPeran: jawab.akun.subPeran, otomatis: true, namaAkun: jawab.akun.nama };
}
