import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { isPrivilegedAdmin } from "@/lib/permissions";
import { requireActorUser } from "@/server/modules/organization/service";
import {
  bacaPengaturanAntrianPublik,
  simpanPengaturanAntrianPublik,
} from "@/server/modules/antrian-publik/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { ApiError } from "@/server/shared/errors";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pengaturan layar antrian yang dapat dibuka tanpa login.
 *
 * ============================================================================
 * MEMBACA BOLEH TIAP PENGGUNA, MENGUBAH HANYA ADMIN
 * ============================================================================
 *
 * Yang diubah di sini menentukan apa yang dapat dibaca orang di LUAR portal -
 * termasuk nomor perkara dan nama para pihak, bila ruas itu dinyalakan.
 * Keputusan sebesar itu bukan milik siapa pun yang kebetulan dapat membuka
 * layar antrian; ia milik Admin atau Super Admin, dan tiap perubahannya
 * tercatat beserta nama penulisnya di kolom diperbarui_oleh.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await requireActorUser(db, actorUserId);
    return ok(await bacaPengaturanAntrianPublik(db));
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ANTRIAN_PUBLIK_BACA_FAILED",
      feature: "aleta_ecourt",
    });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await requireActorUser(db, actorUserId);
    if (!isPrivilegedAdmin(aktor)) {
      throw new ApiError(
        403,
        "Hanya Admin atau Super Admin yang dapat mengubah tampilan antrian tanpa login."
      );
    }

    const badan = (await request.json().catch(() => ({}))) as {
      aktif?: unknown;
      tampil?: unknown;
      judul?: unknown;
      catatan?: unknown;
    };

    const hasil = await simpanPengaturanAntrianPublik(db, actorUserId, {
      aktif: badan.aktif !== false,
      tampil: badan.tampil,
      judul: String(badan.judul ?? ""),
      catatan: String(badan.catatan ?? ""),
    });
    return ok(hasil);
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ANTRIAN_PUBLIK_SIMPAN_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
