import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { kirimPenetapanHapusGateway } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { alamatIpPeramban } from "@/server/shared/request";
import { getUserByIdFromDb } from "@/server/modules/organization/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Membongkar satu penetapan yang sudah tertulis ke SIPP.
 *
 * ============================================================================
 * KERING SEBAGAI BAWAAN, SAMA SEPERTI MENULIS
 * ============================================================================
 *
 * Permintaan yang lupa menyebut { kering: false } memulangkan RENCANA
 * pembongkaran, bukan pembongkarannya. Menghapus penetapan tidak dapat
 * dibatalkan dengan menekan ulang, dan nilai bawaan yang lalai di sini
 * berakibat pada berkas perkara yang sungguhan.
 *
 * ============================================================================
 * OPERATORNYA DARI SESI, BUKAN DARI PERAMBAN
 * ============================================================================
 *
 * Nama yang tercatat sebagai pembongkar diambil dari akun ALETA yang sedang
 * masuk. Menerimanya dari badan permintaan berarti siapa pun yang dapat
 * memanggil rute ini dapat menuliskan nama orang lain pada catatan audit.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    // Kemampuan yang sama dengan menulis penetapan. Yang boleh menuliskannya,
    // dialah yang boleh membongkarnya kembali - memisahkannya hanya akan
    // menghasilkan perkara separuh tertulis yang tidak seorang pun berwenang
    // membereskan.
    await pastikanKapabilitas(db, actorUserId, "penunjukan");

    const aktor = actorUserId ? await getUserByIdFromDb(db, actorUserId) : null;
    const operator = String(aktor?.name || aktor?.email || actorUserId || "").trim();
    if (!operator) {
      return Response.json({ ok: false, alasan: "operator_tidak_dikenali" }, { status: 403 });
    }

    const badan = (await request.json()) as Record<string, unknown>;

    const JENIS_BAKU: Record<string, string> = { pmh: "pmh", ppp: "ppp", pjs: "pjs", phs: "phs" };
    const jenis = JENIS_BAKU[String(badan.jenis || "").toLowerCase()];
    if (!jenis) {
      return Response.json({ ok: false, alasan: "jenis_tidak_didukung" }, { status: 400 });
    }

    const perkaraId = Number(badan.perkaraId);
    if (!Number.isFinite(perkaraId) || perkaraId <= 0) {
      return Response.json({ ok: false, alasan: "perkara_tidak_sah" }, { status: 400 });
    }

    const olehUsername = String(badan.olehUsername || "").trim();
    if (!olehUsername) {
      return Response.json({ ok: false, alasan: "akun_pejabat_tidak_disebut" }, { status: 400 });
    }

    const kering = badan.kering !== false;

    const respons = await kirimPenetapanHapusGateway({
      jenis,
      perkaraId,
      olehUsername,
      operator,
      kering,
      ip: alamatIpPeramban(request),
    });

    return Response.json(respons, { status: respons?.ok === false ? 409 : 200 });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_PENETAPAN_HAPUS_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
