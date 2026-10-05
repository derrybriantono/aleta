import { type NextRequest } from "next/server";

import { panggilBotPanggil } from "@/server/modules/panggil-petugas/gateway";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * PENGUMUMAN SUARA PANGGILAN PETUGAS - UNTUK LAYAR YANG TERSAMBUNG PENGERAS
 * ============================================================================
 *
 * Butir 33 (5 Oktober 2026): "Panggil (audio speaker)" di Jadwal Sidang /
 * Hasil Sidang / Jadwal Mediasi mencatat satu pengumuman; layar antrian ruang
 * tunggu, layar antrian portal, dan papan panggil menanyai rute ini tiap
 * beberapa detik dan mengucapkannya dengan suara peramban (Web Speech API,
 * id-ID) - tidak ada suara yang dibuat di server.
 *
 *   GET ?sejakId=N   pengumuman bernomor > N yang umurnya < 3 menit
 *   GET              hanya id terakhir (layar yang baru dibuka tidak memutar
 *                    ulang pengumuman yang sudah lewat)
 *
 * Tanpa login, sama dengan layar antrian umum yang memakainya. Yang keluar
 * HANYA kalimat pengumuman - kalimat yang memang diucapkan lewat pengeras
 * suara di ruang tunggu (peran + nama petugas + ruang + nomor perkara). Nama
 * pihak tidak pernah ada di sini: pihak tidak dapat diumumkan lewat suara.
 */
export async function GET(request: NextRequest) {
  const sejak = new URL(request.url).searchParams.get("sejakId");
  const angka = sejak !== null && /^\d{1,15}$/.test(sejak) ? sejak : "";
  const hasil = await panggilBotPanggil<{
    ok: boolean;
    terakhirId?: number;
    daftar?: Array<{ id: number; teks: string }>;
  }>(`/pengumuman?sejakId=${angka}`, { timeoutMs: 5000 });
  if (!hasil.ok || !hasil.data.ok) {
    return ok({ available: false, terakhirId: Number(angka) || 0, daftar: [] });
  }
  return ok({
    available: true,
    terakhirId: Number(hasil.data.terakhirId) || 0,
    daftar: (hasil.data.daftar ?? []).map((x) => ({ id: Number(x.id), teks: String(x.teks || "").slice(0, 400) })),
  });
}
