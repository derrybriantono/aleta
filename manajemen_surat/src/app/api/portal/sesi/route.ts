import { headers } from "next/headers";
import { type NextRequest } from "next/server";

import { getAuth } from "@/lib/auth";
import { getDatabase } from "@/server/db/client";
import { tandaiSesi } from "@/server/modules/portal/sesi-portal";
import { handleRouteError, ok, unauthorized } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Menandai sesi yang baru dibuat: diingat atau tidak.
 *
 * ============================================================================
 * DIPANGGIL SESUDAH MASUK, DAN TIDAK MENJADI SYARAT MASUK
 * ============================================================================
 *
 * Halaman masuk memanggilnya tepat sesudah Better Auth membuat sesinya. Bila
 * panggilan ini gagal - jaringan tersendat, tab ditutup - sesinya tetap ada
 * dan tetap dapat dipakai; yang terjadi hanya ia diperlakukan sebagai TIDAK
 * diingat, yaitu dua jam. Arahnya sengaja ke sisi yang lebih ketat.
 *
 * Yang ditandai selalu sesi MILIK PEMANGGIL sendiri - tidak ada ruas yang
 * menyebut sesi lain. Menaikkan masa berlaku sesi orang lain bukan sesuatu
 * yang perlu dapat dilakukan dari mana pun.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuth();
    const session = await auth.api.getSession({ headers: await headers() });
    const sessionId = session?.session?.id;

    // unauthorized() melempar; tidak ada jalan lanjut sesudahnya.
    if (!sessionId) unauthorized();

    const body = await readJsonBody<{ diingat?: unknown }>(request).catch(() => ({}) as { diingat?: unknown });
    const db = await getDatabase();
    await tandaiSesi(db, String(sessionId), body.diingat === true);

    return ok({ ditandai: true, diingat: body.diingat === true });
  } catch (error) {
    return handleRouteError(error);
  }
}
