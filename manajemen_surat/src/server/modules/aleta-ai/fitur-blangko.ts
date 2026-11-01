import { cariFitur, FITUR_BLANGKO, susunPesanPemicu, susunPesanFitur } from "@/lib/aleta-ai/fitur-blangko";
import { KELOMPOK_PUTUSAN, pilihRute, type TabelRute } from "@/lib/aleta-ai/rute";
import { bolehDrafPenetapanAi, bolehKemampuanAi, type TimpaanKemampuanAi } from "@/lib/matriks-peran";
import { golonganPelakuAi, type PelakuAi } from "@/server/modules/aleta-ai/akses";
import type { MasukanPesan } from "@/server/modules/aleta-ai/mesin";
import { ApiError } from "@/server/shared/errors";

/**
 * Jembatan rute HTTP -> mesin untuk fitur bantu panel Blangko Derry (1 Nov 2026).
 * Tidak ada rute baru: rute "pesan" dan "perkiraan" yang ada menerima `fitur` + `bahan` (+ `proyekId`) di samping `teks`/`pemicu`.
 */

export type BadanFitur = { teks?: unknown; pemicu?: unknown; fitur?: unknown; bahan?: unknown; proyekId?: unknown; dompet?: unknown };

/** Badan permintaan -> masukan mesin. Tanpa `fitur`: bentuk lama persis. Fitur/bahan tak sah -> 400 dengan kalimat siap tampil. */
export function masukanDariBadan(badan: BadanFitur): MasukanPesan {
  const m = masukanDasar(badan);
  return String(badan.dompet ?? "") === "satker" ? { ...m, dompet: "satker" } : m;
}

function masukanDasar(badan: BadanFitur): MasukanPesan {
  const kode = String(badan.fitur ?? "").trim();
  const pemicu = String(badan.pemicu ?? "").trim();
  if (!kode && pemicu && badan.bahan && typeof badan.bahan === "object") {
    // Menu proyek di panel Blangko Derry: pemicu proyek + data perkara (bahan) sebagai teks; rute dan modul ditentukan pemicunya.
    const p = susunPesanPemicu(String(badan.teks ?? ""), badan.bahan as Parameters<typeof susunPesanPemicu>[1]);
    if (!p.ok) throw new ApiError(400, p.alasan);
    return { teks: p.teks, pemicu, samarkan: p.samarkan, proyekId: String(badan.proyekId ?? "").trim().slice(0, 80) };
  }
  if (!kode) return { teks: String(badan.teks ?? ""), pemicu };
  const bahan = badan.bahan && typeof badan.bahan === "object" ? (badan.bahan as Parameters<typeof susunPesanFitur>[1]) : null;
  const p = susunPesanFitur(kode, bahan);
  if (!p.ok) throw new ApiError(400, p.alasan);
  return {
    teks: p.teks,
    kelompok: p.fitur.kelompok,
    ...(p.fitur.kemampuan ? { kemampuan: p.fitur.kemampuan } : {}),
    samarkan: p.samarkan,
    fitur: p.fitur.kode,
    proyekId: String(badan.proyekId ?? "").trim().slice(0, 80),
  };
}

/** Kode fitur yang boleh dipakai pelaku ini (hak rute dan kemampuan peran; keputusan akhir tetap di mesin). */
export function fiturBlangkoBoleh(tabel: TabelRute, pelaku: PelakuAi, timpaan?: TimpaanKemampuanAi | null): string[] {
  const golongan = golonganPelakuAi(pelaku);
  const hasil: string[] = [];
  for (const f of FITUR_BLANGKO) {
    const rute = pilihRute(tabel, f.kelompok, pelaku.peranId);
    if (!rute.ok) continue;
    // Draf putusan tidak punya "versi ringan": diturunkan = tidak ditawarkan.
    if (f.kelompok === KELOMPOK_PUTUSAN && rute.diturunkan) continue;
    if (f.kemampuan === "draf-penetapan") {
      if (!bolehDrafPenetapanAi(golongan, "", timpaan)) continue;
    } else if (f.kemampuan && !bolehKemampuanAi(golongan, f.kemampuan, timpaan)) continue;
    hasil.push(f.kode);
  }
  return hasil.filter((k) => cariFitur(k));
}
