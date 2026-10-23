import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pelakuAi } from "@/server/modules/aleta-ai/akses";
import { usulkanKiriman } from "@/server/modules/aleta-ai/kiriman";
import { resolveActorUserId } from "@/server/shared/auth";
import { created, handleRouteError } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ALETA Ai tahap 3 - langkah 1 "Kirim ke alur ALETA": POST {tujuan, isian?}
 * -> usulan + PRATINJAU nilai yang akan dikirim (status menunggu-konfirmasi).
 * Belum ada yang terkirim sampai petugas mengonfirmasi (POST /api/aleta-ai/kiriman/[id]).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = await getDatabase();
    const pelaku = await pelakuAi(db, await resolveActorUserId(request));
    const { id } = await params;
    const badan = (await request.json().catch(() => ({}))) as { tujuan?: unknown; isian?: unknown };
    return created(await usulkanKiriman(db, pelaku, id, badan));
  } catch (error) {
    return handleRouteError(error);
  }
}
