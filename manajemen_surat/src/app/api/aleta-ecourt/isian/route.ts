import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  kesiapanIsian,
  penandaKelasB,
  riwayatIsian,
  simpanIsian,
} from "@/server/modules/aleta-ecourt/isian-perkara";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { getSearchParam } from "@/server/shared/request";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Isian perkara untuk Kelas B (Tahap 3 - Kemandirian Blangko).
 *
 *   GET ?perkaraId=..&penanda=1001,0650   isian yang dibutuhkan, sudah dikelompokkan
 *   GET ?perkaraId=..&noVar=1001&riwayat=1  riwayat penyuntingan satu isian
 *
 *   POST {perkaraId, nilai:{noVar:teks}}  menyimpan isian
 *
 * ============================================================================
 * KEWENANGANNYA "panel", SAMA DENGAN BAS
 * ============================================================================
 *
 * Yang mengisi adalah panitera sidang dan hakim yang menyidangkan - orang yang
 * sama yang menulis BAS. Menuntut kewenangan admin di sini berarti fakta
 * perkara harus dititipkan kepada orang yang tidak menghadiri sidangnya.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const perkaraId = String(getSearchParam(request, "perkaraId") ?? "").trim();
    if (!perkaraId) return ok({ ada: false, sebab: "Perkara harus disebutkan." });

    const noVar = String(getSearchParam(request, "noVar") ?? "").trim();
    if (noVar && String(getSearchParam(request, "riwayat") ?? "").trim() === "1") {
      return ok({ ada: true, riwayat: await riwayatIsian(db, perkaraId, noVar) });
    }

    // "semua=1" dipakai layar perkara, yang membukanya SEBELUM ada blangko
    // terpilih. Yang dikembalikan hanya Kelas B yang benar-benar dipakai
    // pustaka blangko - meminta panitera mengisi keterangan yang tidak akan
    // pernah tercetak di mana pun hanya menambah kotak kosong.
    const semua = String(getSearchParam(request, "semua") ?? "").trim() === "1";
    const penanda = semua
      ? await penandaKelasB(db)
      : String(getSearchParam(request, "penanda") ?? "")
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);
    if (penanda.length === 0) {
      return ok({
        ada: false,
        sebab: semua
          ? "Belum ada variabel Kelas B di kamus. Salin kamus variabel lebih dulu."
          : "Penanda blangko harus disebutkan.",
      });
    }

    const hasil = await kesiapanIsian(db, perkaraId, penanda);
    return ok({ ada: true, ...hasil });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ISIAN_PERKARA_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "isian-perkara",
    });
  }
}

type Masukan = { perkaraId?: string; nilai?: Record<string, string>; olehNama?: string };

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const masukan = (await request.json()) as Masukan;
    return ok(
      await simpanIsian(db, {
        perkaraId: String(masukan.perkaraId ?? ""),
        nilai: masukan.nilai ?? {},
        oleh: String(masukan.olehNama ?? "") || String(actorUserId ?? ""),
      })
    );
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ISIAN_PERKARA_SIMPAN_FAILED",
      feature: "aleta_ecourt",
      entityId: "isian-perkara",
    });
  }
}
