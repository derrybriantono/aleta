/**
 * Laporan ketepatan tunda/putus otomatis untuk layar Admin/Super Admin (U19, rantai F3).
 * Hanya membaca basis data ALETA; mengisi jejak dari blob lama sekali bila tabel masih kosong.
 */
import type { FiturOtomatis } from "@/lib/otomatis-jejak";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";
import type { AletaDatabase } from "@/server/db/client";
import { pastikanAdminIstimewa } from "@/server/modules/aleta-ecourt/akses";
import { hitungJejak, isiUlangJejakOtomatis, jejakMenyala, laporanKetepatan } from "@/server/modules/otomatis-jejak/jejak";

export const HARI_PILIHAN = [7, 30, 90, 365] as const;
const RINCIAN_MAKS = 100;

/** YYYY-MM-DD dikurangi sekian hari (kalender, tanpa zona waktu). */
export function kurangiHari(tanggal: string, hari: number): string {
  const [t, b, h] = tanggal.split("-").map(Number);
  const d = new Date(Date.UTC(t, b - 1, h - hari));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function bersihkanHari(x: unknown): number {
  const n = Math.round(Number(x));
  return Number.isFinite(n) ? Math.max(1, Math.min(800, n)) : 90;
}

export async function bacaLaporanOtomatis(
  db: AletaDatabase,
  actorUserId: string | null | undefined,
  opsi: { hari?: unknown; fitur?: unknown; kini?: Date } = {}
) {
  await pastikanAdminIstimewa(db, actorUserId, "melihat laporan ketepatan tunda/putus otomatis");
  const hari = bersihkanHari(opsi.hari);
  const fitur: FiturOtomatis | null = opsi.fitur === "tunda" || opsi.fitur === "putus" ? opsi.fitur : null;
  const sampai = waktuPengadilan(opsi.kini).tanggal;
  const dari = kurangiHari(sampai, hari);
  let diisiDariRiwayat: { hariTunda: number; hariPutus: number; baris: number } | null = null;
  let tabelAda = true;
  try {
    // Tabel kosong tetapi blob lama ada: isi sekali (idempoten, hanya menulis ke tabel ALETA).
    if ((await hitungJejak(db)) === 0 && (await jejakMenyala(db))) diisiDariRiwayat = await isiUlangJejakOtomatis(db);
  } catch {
    tabelAda = false;
  }
  if (!tabelAda) {
    return {
      tersedia: false as const,
      pesan: "Tabel jejak otomatis belum ada. Jalankan migrasi basis data (0105) lalu muat ulang halaman.",
      hari,
      fitur,
    };
  }
  const jejakAktif = await jejakMenyala(db);
  const l = await laporanKetepatan(db, { dari, sampai, fitur });
  const rincian = l.baris
    .filter((b) => b.keputusan !== "lewati")
    .slice(0, RINCIAN_MAKS)
    .map((b) => ({
      tanggal: b.tanggal,
      fitur: b.fitur,
      nomorPerkara: b.nomorPerkara,
      keputusan: b.keputusan,
      aturan: b.aturan,
      hasil: b.hasil,
      kering: b.kering,
      pesan: b.pesan,
    }));
  return {
    tersedia: true as const,
    hari,
    fitur,
    dari: l.dari,
    sampai: l.sampai,
    jumlahBaris: l.jumlahBaris,
    aturan: l.aturan,
    dilewati: l.dilewati,
    rincian,
    diisiDariRiwayat,
    jejakAktif,
  };
}

export async function isiUlangDariRiwayat(db: AletaDatabase, actorUserId: string | null | undefined) {
  await pastikanAdminIstimewa(db, actorUserId, "mengisi ulang jejak tunda/putus otomatis");
  return isiUlangJejakOtomatis(db);
}
