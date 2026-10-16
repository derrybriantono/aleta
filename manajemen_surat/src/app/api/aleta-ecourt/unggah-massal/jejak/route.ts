import { type NextRequest } from "next/server";

import { isPrivilegedAdmin } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { bersihkanRingkasan, hakUnggahMassal, hitungRingkasan } from "@/server/modules/aleta-ecourt/unggah-massal";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { appendAuditLog } from "@/server/shared/audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { nextPrefixedId } from "@/server/shared/ids";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AKSI = "UNGGAH_MASSAL_PUTARAN";
const BATAS_RIWAYAT = 30;

/**
 * ============================================================================
 * RIWAYAT UNGGAH MASSAL (F4.1) - SATU BARIS audit_logs PER PUTARAN
 * ============================================================================
 *
 *   POST { jenis, mulai, selesai, berhenti, sebabBerhenti, butir[] } -> { id, jumlah }
 *   GET                                                              -> { riwayat[] }
 *
 * Tiap tulisan ke SIPP SUDAH tercatat sendiri (jejak bot aleta_bot_jejak_penetapan
 * per unggahan, audit_logs rute unggah-sipp). Ini RINGKASAN putaran untuk layar
 * "Riwayat" - siapa, kapan, berapa berhasil/gagal/dobel, dan mengapa berhenti.
 * Tidak perlu tabel baru: audit_logs sudah ada. Admin melihat riwayat semua
 * akun; yang lain riwayatnya sendiri.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "panel");
    const ringkas = bersihkanRingkasan(await readJsonBody<unknown>(request).catch(() => null));
    if (!ringkas) return Response.json({ ok: false, alasan: "Ringkasan putaran tidak sah." }, { status: 400 });
    const hak = hakUnggahMassal(actor);
    if (!hak[ringkas.jenis]) return Response.json({ ok: false, alasan: "Peran Anda tidak diberi hak unggah untuk jenis ini." }, { status: 403 });
    const jumlah = hitungRingkasan(ringkas);
    const id = await nextPrefixedId(db, "audit_logs", "adt");
    await appendAuditLog(db, {
      id,
      actorUserId: actor?.id ?? actorUserId,
      action: AKSI,
      entityType: "unggah_massal",
      entityId: ringkas.jenis,
      payload: { ...ringkas, jumlah, oleh: String(actor?.name || actor?.email || "") },
    });
    return ok({ id, jumlah });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "UNGGAH_MASSAL_JEJAK_FAILED",
      feature: "aleta_ecourt",
      entityId: "unggah-massal-jejak",
    });
  }
}

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "panel");
    const semua = isPrivilegedAdmin(actor);
    const baris = await db.queryAll<{ id: string; actor_user_id: string | null; payload_json: string | null; created_at: string }>(
      semua
        ? `SELECT id, actor_user_id, payload_json, created_at FROM audit_logs WHERE action = ? ORDER BY created_at DESC LIMIT ${BATAS_RIWAYAT}`
        : `SELECT id, actor_user_id, payload_json, created_at FROM audit_logs WHERE action = ? AND actor_user_id = ? ORDER BY created_at DESC LIMIT ${BATAS_RIWAYAT}`,
      semua ? [AKSI] : [AKSI, String(actor?.id ?? actorUserId ?? "")]
    );
    const riwayat = baris.flatMap((b) => {
      try {
        const p = JSON.parse(String(b.payload_json || "{}"));
        return [{ id: b.id, dicatat: b.created_at, ...p }];
      } catch {
        return [];
      }
    });
    return ok({ semua, riwayat });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "UNGGAH_MASSAL_RIWAYAT_FAILED",
      feature: "aleta_ecourt",
      entityId: "unggah-massal-jejak",
    });
  }
}
