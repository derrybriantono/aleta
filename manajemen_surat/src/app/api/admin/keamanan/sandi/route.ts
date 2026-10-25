import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import {
  BATAS_KEBIJAKAN_SANDI,
  bacaKebijakanSandi,
  daftarAkunBelumMemenuhi,
  simpanKebijakanSandi,
  type UbahKebijakanSandi,
} from "@/server/modules/keamanan/kebijakan-sandi";
import { appendAuditLog } from "@/server/shared/audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";
import { nextPrefixedId } from "@/server/shared/ids";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Kebijakan sandi (Bagian 6a). Baca = Admin + Super Admin (keamanan.lihat);
 * ubah = Super Admin (keamanan.atur). Saklar mati bawaan - lihat
 * server/modules/keamanan/kebijakan-sandi.ts.
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    await pastikanAksi(db, await resolveActorUserId(request), "keamanan.lihat");
    return ok({
      kebijakan: await bacaKebijakanSandi(db),
      belumMemenuhi: await daftarAkunBelumMemenuhi(db),
      batas: BATAS_KEBIJAKAN_SANDI,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await pastikanAksi(db, await resolveActorUserId(request), "keamanan.atur");
    const body = await readJsonBody<UbahKebijakanSandi>(request).catch(() => ({}) as UbahKebijakanSandi);
    let baru;
    try {
      baru = await simpanKebijakanSandi(
        db,
        {
          aktif: body.aktif,
          panjangMin: body.panjangMin,
          tolakUmum: body.tolakUmum,
          tolakIdentitas: body.tolakIdentitas,
          wajibCampuran: body.wajibCampuran,
          riwayatN: body.riwayatN,
          masaBerlakuHari: body.masaBerlakuHari,
        },
        actor.id
      );
    } catch (galat) {
      throw new ApiError(400, galat instanceof Error ? galat.message : "Kebijakan sandi tidak tersimpan.");
    }
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "SECURITY_PASSWORD_POLICY_UPDATE",
      entityType: "security_setting",
      entityId: "kebijakan-sandi",
      payload: baru,
    });
    return ok({ kebijakan: baru, belumMemenuhi: await daftarAkunBelumMemenuhi(db), batas: BATAS_KEBIJAKAN_SANDI });
  } catch (error) {
    return handleRouteError(error);
  }
}
