import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { kirimPenetapanTulisGateway } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { getUserByIdFromDb } from "@/server/modules/organization/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * MENULIS PENETAPAN KE SIPP - RUTE YANG PALING BERAT AKIBATNYA
 * ============================================================================
 *
 * Seluruh rute lain di ALETA membaca SIPP. Rute ini menulis, dan yang ditulis
 * tercatat atas nama PEJABAT sedangkan yang menekan tombolnya operator - itu
 * keputusan pimpinan pengadilan ini, dan bentuk penjagaannya ada di sini.
 *
 * ============================================================================
 * KERING SEBAGAI BAWAAN
 * ============================================================================
 *
 * Permintaan yang tidak menyebut apa-apa menghasilkan hasil KERING: daftar
 * pernyataan lengkap yang akan dikirim, tanpa satu pun dijalankan. Menulis
 * menuntut { kering: false } yang tegas.
 *
 * ============================================================================
 * OPERATOR DIAMBIL DARI SESI, BUKAN DARI PERAMBAN
 * ============================================================================
 *
 * Satu-satunya catatan yang menyimpan siapa SEBENARNYA yang menekan tombolnya
 * adalah nama operator pada judul baris sys_audittrail. Kalau nama itu boleh
 * dikirim peramban, ia dapat diisi apa saja - dan jalur ini kehilangan
 * satu-satunya hal yang membedakannya dari memalsukan tanda tangan.
 *
 * Karena itu operatornya diambil dari akun ALETA yang sedang masuk, dan badan
 * permintaan yang mencoba menyebutnya diabaikan.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    // Kemampuan yang sama dengan papan penunjukan - yang boleh mengusulkan,
    // dialah yang boleh menetapkan. Memisahkannya menjadi kemampuan tersendiri
    // hanya akan menghasilkan satu daftar izin lagi yang tidak pernah diisi.
    await pastikanKapabilitas(db, actorUserId, "penunjukan");

    const aktor = actorUserId ? await getUserByIdFromDb(db, actorUserId) : null;
    const operator = String(aktor?.name || aktor?.email || actorUserId || "").trim();
    if (!operator) {
      return Response.json({ ok: false, alasan: "operator_tidak_dikenali" }, { status: 403 });
    }

    const badan = (await request.json()) as Record<string, unknown>;

    const jenis = String(badan.jenis || "").toLowerCase();
    if (!["pmh", "ppp", "pjs", "phs"].includes(jenis)) {
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

    // Menulis HARUS diminta tegas. Permintaan yang lupa menyebutnya
    // menghasilkan hasil kering, bukan tulisan.
    const kering = badan.kering !== false;

    const respons = await kirimPenetapanTulisGateway({
      jenis,
      perkaraId,
      tanggalPenetapan: String(badan.tanggalPenetapan || ""),
      hakimId: Array.isArray(badan.hakimId)
        ? (badan.hakimId as unknown[]).map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0)
        : undefined,
      petugasId: badan.petugasId === undefined ? undefined : Number(badan.petugasId),
      tanggalSidang: badan.tanggalSidang === undefined ? undefined : String(badan.tanggalSidang),
      ruanganId: badan.ruanganId === undefined ? undefined : Number(badan.ruanganId),
      jamSidang: badan.jamSidang === undefined ? undefined : String(badan.jamSidang),
      olehUsername,
      operator,
      kering,
    });

    return Response.json(respons, { status: respons?.ok === false ? 409 : 200 });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_PENETAPAN_TULIS_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
