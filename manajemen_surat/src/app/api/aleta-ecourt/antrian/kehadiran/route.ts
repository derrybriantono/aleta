import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { getGatewayKehadiranRinci, ubahKeadaanKehadiran } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * F3.2 (17 Okt 2026) - kehadiran rinci per orang.
 *
 * GET  ?perkaraId=1,2&tanggal=YYYY-MM-DD  siapa saja yang hadir (bawaan hari
 *      ini). Dipakai blangko Tunda/Putus, BAS, layar operator, dan panel
 *      ekstensi di SIPP. Hanya membaca.
 * POST {perkaraId, id, keadaan}  menandai satu orang pulang / kembali / saksi
 *      sudah diperiksa. Tidak menyentuh aplikasi antrian - nomor tidak
 *      bergeser - tetapi tetap menuntut hak "sidang.antrian" yang sama dengan
 *      mencatat kehadiran.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const perkaraId = String(request.nextUrl.searchParams.get("perkaraId") || "")
      .split(",")
      .map((x) => x.trim())
      .filter((x) => /^\d+$/.test(x))
      .slice(0, 500);
    const tanggal = String(request.nextUrl.searchParams.get("tanggal") || "").slice(0, 10);
    if (perkaraId.length === 0) {
      return ok({ available: true, ok: false, alasan: "Perkara belum disebut.", kehadiran: {} });
    }
    if (tanggal && !/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
      return ok({ available: true, ok: false, alasan: "Tanggal wajib berbentuk YYYY-MM-DD.", kehadiran: {} });
    }

    const hasil = await getGatewayKehadiranRinci({ perkaraId, tanggal });
    if (!hasil.ok) {
      return ok({ available: false, ok: false, message: hasil.error || "ALETA Bot belum dapat dihubungi.", kehadiran: {} });
    }
    return ok({ available: true, ok: true, tanggal, kehadiran: hasil.data?.kehadiran ?? {} });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ANTRIAN_KEHADIRAN_BACA_FAILED",
      feature: "antrian",
      entityId: "antrian-kehadiran",
    });
  }
}

const KEADAAN = new Set(["pulang", "kembali", "diperiksa", "belum-diperiksa"]);

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanKapabilitas(db, actorUserId, "panel");
    await pastikanAksi(db, actorUserId, "sidang.antrian");

    const isi = (await request.json().catch(() => ({}))) as { perkaraId?: string; id?: string; keadaan?: string };
    const perkaraId = String(isi.perkaraId ?? "").trim();
    const id = String(isi.id ?? "").trim();
    const keadaan = String(isi.keadaan ?? "").trim();
    if (!perkaraId || !id) return ok({ ok: false, alasan: "Orang yang hadir belum dipilih." });
    if (!KEADAAN.has(keadaan)) return ok({ ok: false, alasan: "Keadaan tidak dikenali." });

    const hasil = await ubahKeadaanKehadiran({
      perkaraId,
      id,
      keadaan: keadaan as "pulang" | "kembali" | "diperiksa" | "belum-diperiksa",
      oleh: aktor.name || String(actorUserId ?? "petugas"),
    });
    if (!hasil.ok) return ok({ ok: false, alasan: hasil.error || "Keadaan belum dapat disimpan." });
    return ok(hasil.data ?? { ok: false, alasan: "Keadaan belum dapat disimpan." });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ANTRIAN_KEHADIRAN_UBAH_FAILED",
      feature: "antrian",
      entityId: "antrian-kehadiran",
    });
  }
}
