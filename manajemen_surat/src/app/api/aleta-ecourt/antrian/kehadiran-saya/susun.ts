import {
  bahanKehadiranDariBaris,
  kunciKehadiran,
  ringkasKehadiran,
  susunKehadiran,
  type AntrianKehadiran,
  type BarisJadwalHadir,
  type KehadiranOrang,
  type PotonganRingkas,
} from "@/lib/kehadiran-rinci";

import { sebagaiApa, type BarisSidangSaya } from "../../perkara-saya/susun";

/**
 * F3.2 (17 Okt 2026) - kehadiran sidang HARI INI milik akun, untuk widget
 * ALETA di SIPP/ABT. Fungsi murni: baris jadwal + antrian bot masuk, daftar
 * ringkas keluar. Aturan kalimatnya @/lib/kehadiran-rinci - sama persis dengan
 * Jadwal Sidang, layar operator, dan blangko.
 */

export type BarisKehadiranSaya = BarisSidangSaya & BarisJadwalHadir;

export type KehadiranSaya = {
  perkaraId: string;
  nomorPerkara: string;
  jam: string;
  ruangan: string;
  nomorAntrian: number | null;
  /** hakim / pp / js - kosong bila admin melihat semua. */
  sebagai: string[];
  ringkas: Array<Pick<PotonganRingkas, "teks" | "nada" | "judul">>;
  sedangDisidang: boolean;
  selesai: boolean;
};

export const BATAS_PERKARA_WIDGET = 40;

function teks(nilai: unknown): string {
  return String(nilai ?? "").trim();
}

export function susunKehadiranSaya(
  baris: BarisKehadiranSaya[],
  antrian: { peta?: Record<string, unknown>; kehadiran?: Record<string, { hadir: KehadiranOrang[] }> } | null | undefined,
  opsi: { hariIni: string; nama: string; lihatSemua: boolean }
): { perkara: KehadiranSaya[]; jumlah: number } {
  const hasil: KehadiranSaya[] = [];
  const sudah = new Set<string>();
  for (const b of Array.isArray(baris) ? baris : []) {
    const perkaraId = teks(b.perkaraId);
    const tanggal = teks(b.tanggalSidang).slice(0, 10);
    if (!perkaraId || tanggal !== opsi.hariIni || sudah.has(perkaraId)) continue;
    const sebagai = opsi.lihatSemua ? [] : sebagaiApa(b, opsi.nama);
    if (!opsi.lihatSemua && sebagai.length === 0) continue;
    sudah.add(perkaraId);

    const mentah = (antrian?.peta?.[perkaraId] ?? null) as (AntrianKehadiran & { tanggalSidang?: string; nomor?: number | null }) | null;
    // Antrian berkunci perkara_id - baris hari lain tidak dipakai (gagal-tertutup).
    const baris1 = mentah && teks(mentah.tanggalSidang).slice(0, 10) === tanggal ? mentah : null;
    const hadir = antrian?.kehadiran?.[kunciKehadiran(perkaraId, tanggal)]?.hadir ?? [];
    const susun = susunKehadiran(hadir, baris1);
    const ringkas = ringkasKehadiran(susun, bahanKehadiranDariBaris(b)).map(({ teks: t, nada, judul }) => ({ teks: t, nada, judul }));
    hasil.push({
      perkaraId,
      nomorPerkara: teks(b.nomorPerkara),
      jam: teks(b.jamSidang).slice(0, 5),
      ruangan: teks(b.ruangan),
      nomorAntrian: baris1 && Number.isFinite(Number(baris1.nomor)) && baris1.nomor !== null ? Number(baris1.nomor) : null,
      sebagai,
      // Perkara tanpa catatan apa pun tetap disebut, supaya "belum ada yang
      // datang" terbaca - bukan hilang dari daftar.
      ringkas: ringkas.length ? ringkas : [{ teks: "Belum ada yang tercatat hadir", nada: "abu", judul: "Belum ada yang mengambil nomor antrian atau dicatat petugas." }],
      sedangDisidang: susun.ruang === "disidang",
      selesai: susun.ruang === "selesai",
    });
  }
  // Yang sedang disidang dulu, lalu menurut nomor antrian, lalu jam jadwal.
  hasil.sort(
    (a, b) =>
      Number(b.sedangDisidang) - Number(a.sedangDisidang) ||
      Number(a.selesai) - Number(b.selesai) ||
      (a.nomorAntrian ?? 9999) - (b.nomorAntrian ?? 9999) ||
      a.jam.localeCompare(b.jam) ||
      a.nomorPerkara.localeCompare(b.nomorPerkara)
  );
  return { perkara: hasil.slice(0, BATAS_PERKARA_WIDGET), jumlah: hasil.length };
}
