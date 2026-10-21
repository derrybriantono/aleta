import { type NextRequest } from "next/server";

import { isPrivilegedAdmin } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import { getGatewayTarikSatu, mintaGatewayTarikSatu } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { appendAuditLog } from "@/server/shared/audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";
import { nextPrefixedId } from "@/server/shared/ids";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tombol "Tarik data" di kepala halaman perkara SIPP (21 Okt 2026): menarik
 * e-Court HANYA satu perkara.
 *
 *   GET  ?nomor=...                       keadaan tarikan perkara itu (dibaca layar berkala)
 *   POST { nomorPerkara, paksa? }         meminta tarikan
 *
 * ============================================================================
 * HAK
 * ============================================================================
 *
 * Meminta tarikan memakai kemampuan "permintaan" (Titip permintaan penarikan) -
 * yang SAMA dengan tombol "Tarik dari e-Court" di panel dan penarikan satu
 * perkara dari portal: Super Admin dan Admin selalu, ditambah peran pemegang
 * perkara (atau yang diberi administrator di Integrasi e-Court). Peran yang
 * tidak diberi tidak melihat tombolnya, dan DI SINI ditolak 403 walau
 * ekstensinya diubah.
 *
 * `paksa` (menarik ulang walau datanya masih segar, di bawah 10 menit) HANYA
 * untuk Super Admin dan Admin: dari peran lain ditolak 403, bukan diabaikan
 * diam-diam. Bot tidak menilai peran; portal yang memutuskan.
 *
 * ============================================================================
 * BATAS LAJU DAN ANTREAN
 * ============================================================================
 *
 * Dijaga di bot (ecourtTarikSatuService): satu tarikan sekaligus per server,
 * hanya di sela penarikan utama, tidak membuka sesi e-Court tambahan, satu
 * perkara tidak ditarik ulang dalam 10 menit. Portal hanya meneruskan, dan
 * mencatat siapa-kapan di jejak ALETA bila tarikan benar-benar diterima
 * (dimulai / diantrekan). Tidak ada tulisan ke SIPP.
 */

const PANJANG_NOMOR = 191;

function bersihNomor(nilai: unknown) {
  return String(nilai ?? "").replace(/\s+/g, " ").trim().slice(0, PANJANG_NOMOR);
}

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "permintaan");

    const nomor = bersihNomor(request.nextUrl.searchParams.get("nomor"));
    if (!nomor) return ok({ available: true, ok: false, alasan: "nomor_perkara_kosong" });

    const hasil = await getGatewayTarikSatu(nomor);
    if (!hasil.ok) {
      return ok({ available: false, ok: false, message: hasil.error || "Bot belum dapat dihubungi." });
    }
    return ok({ available: true, ...(hasil.data ?? { ok: false }), bolehPaksa: isPrivilegedAdmin(actor) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_TARIK_SATU_READ_FAILED",
      feature: "aleta_ecourt",
      entityId: "tarik-satu",
    });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "permintaan");

    const badan = await readJsonBody<{ nomorPerkara?: unknown; paksa?: unknown }>(request).catch(
      () => ({}) as { nomorPerkara?: unknown; paksa?: unknown }
    );
    const nomor = bersihNomor(badan.nomorPerkara);
    if (!nomor) return ok({ available: true, ok: false, alasan: "nomor_perkara_kosong", pesan: "Nomor perkara tidak terbaca." });

    const admin = isPrivilegedAdmin(actor);
    const paksa = badan.paksa === true;
    if (paksa && !admin) {
      throw new ApiError(403, "Menarik ulang sebelum 10 menit hanya untuk Super Admin dan Admin.");
    }

    // Nama peminta SELALU dari akun yang masuk, tidak pernah dari badan permintaan.
    const hasil = await mintaGatewayTarikSatu(nomor, actor.name, paksa);
    if (!hasil.ok) {
      // Penolakan wajar bot (antrean penuh, akun tidak siap, ...) membawa alasan.
      const badanBot = (hasil as { badan?: Record<string, unknown> }).badan;
      if (badanBot && typeof badanBot.alasan === "string") {
        return ok({ available: true, ...badanBot, bolehPaksa: admin });
      }
      return ok({ available: false, ok: false, message: hasil.error || "Bot belum dapat dihubungi." });
    }

    const data = hasil.data ?? { ok: false };
    // Jejak ALETA hanya untuk tarikan yang benar-benar diterima; bot sudah
    // mencatat permintaannya sendiri di tabel permintaan e-Court. Gagal
    // mencatat tidak membatalkan tarikan.
    if (data.hasil === "dimulai" || data.hasil === "diantrekan") {
      try {
        await appendAuditLog(db, {
          id: await nextPrefixedId(db, "audit_logs", "adt"),
          actorUserId: actor.id,
          action: paksa ? "MINTA_TARIK_SATU_PERKARA_PAKSA" : "MINTA_TARIK_SATU_PERKARA",
          entityType: "ecourt_tarik_satu",
          entityId: nomor,
          payload: { nomorPerkara: nomor, hasil: data.hasil, paksa, oleh: actor.name, lewat: "kepala-sipp" },
        });
      } catch (galatJejak) {
        console.warn("[ALETA AUDIT] Gagal mencatat permintaan tarik data satu perkara:", galatJejak);
      }
    }
    return ok({ available: true, ...data, bolehPaksa: admin });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_TARIK_SATU_FAILED",
      feature: "aleta_ecourt",
      entityId: "tarik-satu",
    });
  }
}
