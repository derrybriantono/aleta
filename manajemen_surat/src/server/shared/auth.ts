import { type NextRequest } from "next/server";

import { getAuth } from "@/lib/auth";
import { getDatabase } from "@/server/db/client";
import { hapusSesi, periksaSesi } from "@/server/modules/portal/sesi-portal";

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
          await hapusSesi(db, String(sessionId));
          return extractActorUserId(request, fallbackUserId);
        }
      } catch {
        /* tidak dapat diperiksa: dibiarkan lewat, lihat catatan di atas */
      }
    }

    return userId;
  } catch {
    return extractActorUserId(request, fallbackUserId);
  }
}
