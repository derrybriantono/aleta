import { type NextRequest } from "next/server";

import { getAuth } from "@/lib/auth";
import { getDatabase } from "@/server/db/client";
import { hapusSesi, periksaSesi } from "@/server/modules/portal/sesi-portal";
import { getRequestAuditMetadata } from "@/server/shared/request";

export function extractActorUserId(request: NextRequest, fallbackUserId?: string | null) {
  if (process.env.NODE_ENV === "test") {
    return (
      request.headers.get("x-aleta-user-id") ??
      request.nextUrl.searchParams.get("actorUserId") ??
      fallbackUserId ??
      ""
    );
  }

  return "";
}

/**
 * Siapa yang mengirim permintaan ini - dan apakah sesinya masih boleh dipakai.
 *
 * ============================================================================
 * MASA BERLAKU DIPERIKSA DI SATU TEMPAT SAJA
 * ============================================================================
 *
 * Tiap rute memanggil fungsi ini sebelum berbuat apa pun, jadi inilah
 * satu-satunya tempat yang perlu tahu aturan masa berlaku sesi. Menaruhnya di
 * tengah - pada middleware, misalnya - akan melewatkan rute yang tidak
 * melewatinya; menaruhnya di tiap rute akan membuat satu rute baru yang lupa
 * memeriksanya menjadi lubang yang tidak berbunyi.
 *
 * Sesi yang sudah lewat masanya DIHAPUS, bukan sekadar ditolak. Sesi yang
 * ditolak tetapi tetap ada membuat peramban mengirim kuki yang sama pada tiap
 * permintaan berikutnya, dan penggunanya melihat deretan galat alih-alih satu
 * kali kembali ke halaman masuk.
 *
 * Kegagalan membaca basis data TIDAK memutus sesi: yang tidak dapat diperiksa
 * dibiarkan lewat, sebab Better Auth masih punya masa berlakunya sendiri
 * sebagai batas terakhir, dan memutus seluruh pegawai karena satu gangguan
 * basis data adalah akibat yang jauh lebih besar daripada sebabnya.
 */
export async function resolveActorUserId(request: NextRequest, fallbackUserId?: string | null) {
  // TAUTAN JADWAL SIDANG (20 Okt 2026): permintaan yang membawa rahasia tautan
  // diperiksa DI SINI dan tidak pernah jatuh ke sesi akun - di luar blok try
  // di bawah, supaya penolakannya (jaringan luar, dicabut, rute tak diizinkan,
  // batas laju) tidak ditelan menjadi "tanpa pengguna" lalu dicoba cara lain.
  // Lihat server/modules/tautan-jadwal/service.ts.
  const rahasiaTautan = request.headers.get("x-tautan-jadwal");
  if (rahasiaTautan) {
    const { periksaTautan } = await import("@/server/modules/tautan-jadwal/service");
    const hasil = await periksaTautan(await getDatabase(), request, rahasiaTautan);
    return hasil.aktor.id;
  }

  try {
    const auth = await getAuth();
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    const userId = session?.user?.id;
    if (!userId) return extractActorUserId(request, fallbackUserId);

    const sessionId = session?.session?.id;
    if (sessionId) {
      try {
        const db = await getDatabase();
        const putusan = await periksaSesi(db, String(sessionId), session?.session?.createdAt);
        if (!putusan.berlaku) {
          // Jejak masuk (23 Okt 2026): kedaluwarsa dicatat SEBELUM petanya dihapus.
          const { catatSesiKedaluwarsa } = await import("@/server/modules/perangkat/aktivitas");
          await catatSesiKedaluwarsa(db, { sessionId: String(sessionId), userId: String(userId), sebab: putusan.sebab, headers: request.headers });
          await hapusSesi(db, String(sessionId));
          return extractActorUserId(request, fallbackUserId);
        }
        const { catatAktivitasSesi } = await import("@/server/modules/perangkat/aktivitas");
        await catatAktivitasSesi(db, { sessionId: String(sessionId), userId: String(userId), headers: request.headers });
      } catch {
        /* tidak dapat diperiksa: dibiarkan lewat, lihat catatan di atas */
      }
    }

    await catatAksesSuperAdminGlobalBilaPerlu(request, String(userId), String(sessionId ?? ""));

    return userId;
  } catch {
    return extractActorUserId(request, fallbackUserId);
  }
}

/**
 * Banyak satker: sesi akun SUPER ADMIN GLOBAL (ditandai di env
 * ALETA_SUPER_ADMIN_GLOBAL) dicatat ke jejak audit dan diberitahukan ke admin
 * satker pada kemunculan pertamanya. Tanpa env itu, fungsi ini tidak berbuat
 * apa-apa dan tidak menyentuh basis data. GAGAL KE SISI TERTUTUP: bila jejaknya
 * tidak dapat ditulis, galatnya dilempar ke atas dan sesi itu tidak diterima
 * (tidak ada akses super admin global tanpa jejak). Modul dimuat saat dipanggil
 * supaya lingkaran impor dengan lib/auth tidak terbentuk.
 */
async function catatAksesSuperAdminGlobalBilaPerlu(request: NextRequest, userId: string, sessionId: string) {
  if (!String(process.env.ALETA_SUPER_ADMIN_GLOBAL ?? "").trim()) return;
  try {
    const { catatAksesBilaSuperAdminGlobal } = await import("@/server/modules/satker/akses-global");
    const meta = getRequestAuditMetadata(request);
    await catatAksesBilaSuperAdminGlobal(await getDatabase(), {
      userId,
      sessionId,
      alamatIp: meta.ipAddress,
      agenPengguna: meta.userAgent,
    });
  } catch (galat) {
    console.error("[AKSES GLOBAL] Jejak akses super admin global gagal ditulis; sesi ditolak.", galat);
    throw galat;
  }
}
