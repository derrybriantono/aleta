import type { NextRequest } from "next/server";

import { ApiError } from "@/server/shared/errors";

/**
 * ============================================================================
 * PENJAGA PERMINTAAN - SATU TITIK DI resolveActorUserId (rantai E, 25 Okt 2026)
 * ============================================================================
 *
 * resolveActorUserId dipanggil rute sebelum berbuat apa pun, jadi inilah satu
 * tempat untuk aturan yang berlaku bagi SEMUA permintaan bersesi:
 *
 *   1. MODE PEMELIHARAAN (E3): selagi aktif, permintaan MENULIS dari pengguna
 *      yang tidak dikecualikan ditolak 503 dengan pesan Super Admin.
 *
 * Aturan lain dari rantai ini (Lihat sebagai, verifikasi dua langkah) menyusul
 * di fungsi yang sama di cabangnya masing-masing.
 *
 * Gagal baca basis data = DILEWATKAN (terbuka): penjaga tidak boleh memutus
 * seluruh pegawai karena satu gangguan. Penolakan (ApiError) selalu dilempar.
 * Saklar mati = tidak ada yang berubah dari perilaku lama.
 */
const METODE_BACA = new Set(["GET", "HEAD", "OPTIONS"]);

const peranDiingat = new Map<string, { roleId: string; pada: number }>();
const INGAT_PERAN_MS = 30_000;

async function peranPengguna(userId: string): Promise<string> {
  const ada = peranDiingat.get(userId);
  if (ada && Date.now() - ada.pada < INGAT_PERAN_MS) return ada.roleId;
  const { getDatabase } = await import("@/server/db/client");
  const db = await getDatabase();
  const baris = await db.queryOne<{ role_id: string }>("SELECT role_id FROM users WHERE id = ?", [userId]);
  const roleId = String(baris?.role_id ?? "");
  peranDiingat.set(userId, { roleId, pada: Date.now() });
  return roleId;
}

/** Hanya untuk uji. */
export function kosongkanIngatanPenjaga() {
  peranDiingat.clear();
}

export async function terapkanPenjagaPermintaan(request: NextRequest, userId: string): Promise<string> {
  // Tautan Jadwal Sidang tanpa akun punya penjaganya sendiri (periksaTautan).
  if (request.headers.get("x-tautan-jadwal")) return userId;
  const metode = request.method.toUpperCase();

  // 1. Mode pemeliharaan: hanya menulis yang ditolak.
  if (!METODE_BACA.has(metode)) {
    let tolak: ApiError | null = null;
    try {
      const [{ getDatabase }, pemeliharaan] = await Promise.all([import("@/server/db/client"), import("@/server/modules/pemeliharaan/layanan")]);
      const keadaan = await pemeliharaan.keadaanPemeliharaan(await getDatabase());
      if (keadaan.aktif && !pemeliharaan.jalurTetapBekerja(request.nextUrl.pathname)) {
        const roleId = await peranPengguna(userId);
        if (!pemeliharaan.bolehLewatPemeliharaan(roleId, keadaan)) {
          tolak = new ApiError(503, `${keadaan.pesan} (Pemeliharaan: perubahan data dihentikan sementara.)`, { alasan: "pemeliharaan", selesaiPerkiraan: keadaan.selesaiPerkiraan });
        }
      }
    } catch {
      /* tidak terbaca: dilewatkan */
    }
    if (tolak) throw tolak;
  }

  return userId;
}
