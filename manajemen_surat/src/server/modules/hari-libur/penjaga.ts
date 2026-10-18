import { sebabLibur, petaLiburBerlaku } from "@/lib/hari-libur";
import type { AletaDatabase } from "@/server/db/client";

import { bacaHariLibur } from "./sumber";

/**
 * ============================================================================
 * PENJAGA HARI LIBUR DI DEPAN RUTE TULIS (18 Okt 2026)
 * ============================================================================
 *
 * SIPP sendiri hanya menolak Sabtu dan Minggu (court_calendar validateInput,
 * borang penetapan). Libur nasional, cuti bersama, dan libur tambahan
 * Pengaturan DITERIMA SIPP - jadi dicegah di sini, SEBELUM permintaan
 * diteruskan ke bot. Penjaga ini tidak mengubah apa pun yang ditulis; ia hanya
 * menolak tanggal libur dengan kode alasan yang sudah dikenal panel
 * (tanggal_sidang_hari_libur, tanggal_penetapan_hari_libur).
 *
 * Sabtu/Minggu tetap diperiksa bot (dengan pengecualian jenis perkaranya).
 */
export type TolakLibur = { alasan: "tanggal_sidang_hari_libur" | "tanggal_penetapan_hari_libur"; diminta: string; libur: string };

function liburNasional(iso: string): string {
  const s = sebabLibur(iso, petaLiburBerlaku());
  return s && s.jenis !== "sabtu" && s.jenis !== "minggu" ? s.nama : "";
}

/** Memeriksa tanggal penetapan dan tanggal sidang (PHS) sebuah permintaan penetapan. */
export async function periksaLiburPenetapan(
  db: AletaDatabase,
  tanggalPenetapan: unknown,
  langkah: ReadonlyArray<{ jenis?: string; tanggalSidang?: unknown }>
): Promise<TolakLibur | null> {
  await bacaHariLibur(db);
  const tp = String(tanggalPenetapan ?? "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(tp)) {
    const l = liburNasional(tp);
    if (l) return { alasan: "tanggal_penetapan_hari_libur", diminta: tp, libur: l };
  }
  for (const s of langkah) {
    if (String(s.jenis || "").toLowerCase() !== "phs") continue;
    const ts = String(s.tanggalSidang ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ts)) continue;
    const l = liburNasional(ts);
    if (l) return { alasan: "tanggal_sidang_hari_libur", diminta: ts, libur: l };
  }
  return null;
}
