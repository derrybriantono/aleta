import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  getGatewayKosakata,
  simpanGatewayKosakata,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanAdminIstimewa, pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Jenis kosakata yang boleh ditambah. Yang di luar ini diabaikan. */
const JENIS = ["promosi", "phishing", "pemendek"] as const;

/**
 * ============================================================================
 * KOSAKATA PEMERIKSA PESAN - TAMBAHAN DARI PENGADILAN
 * ============================================================================
 *
 * Tercatat sejak 1.15.0 sebagai keterbatasan: daftar kosakata belum dapat
 * disunting dari portal, sehingga penambahan satu kata menuntut satu putaran
 * paket-unggah-pasang. Untuk satu baris teks - dan itulah sebabnya kosakatanya
 * jarang bertambah, padahal kosakata penipuan yang paling cepat berubah.
 *
 * Yang disimpan hanya TAMBAHAN. Daftar bawaan tetap di dalam kode dan tidak
 * dapat dihapus dari sini: daftar penipuan memuat "kode otp", "nomor
 * rekening", "segera transfer", dan membolehkan penghapusan berarti membolehkan
 * seseorang membuka jalan bagi persis pesan yang paling berbahaya.
 *
 * Membacanya cukup "panel" - siapa pun yang menulis isi pesan berhak tahu apa
 * yang diperiksa atas tulisannya. Mengubahnya menuntut admin istimewa.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const hasil = await getGatewayKosakata();
    if (!hasil.ok) {
      return ok({
        available: false,
        ok: false,
        alasan: hasil.error || "ALETA Bot belum dapat dihubungi.",
      });
    }

    return ok({ available: true, ...(hasil.data as Record<string, unknown>) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "KOSAKATA_READ_FAILED",
      feature: "aleta_bot",
      entityId: "kosakata",
    });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanAdminIstimewa(db, actorUserId, "mengubah kosakata pemeriksa pesan");

    const badan = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const mentah = (badan.tambahan ?? {}) as Record<string, unknown>;

    // Hanya ketiga jenis yang dikenali yang diteruskan. Jenis karangan tidak
    // ditolak dengan galat - ia sekadar tidak ikut, sebab layar lama yang
    // mengirim ruas yang sudah tidak ada tidak boleh gagal menyimpan yang
    // masih berlaku.
    const tambahan = { promosi: [] as string[], phishing: [] as string[], pemendek: [] as string[] };
    for (const jenis of JENIS) {
      const daftar = mentah[jenis];
      tambahan[jenis] = Array.isArray(daftar) ? daftar.map((x) => String(x ?? "")) : [];
    }

    // Nama pengubahnya diambil dari sesi, BUKAN dari badan permintaan.
    const aktor = await requireActorUser(db, actorUserId);

    const hasil = await simpanGatewayKosakata({
      tambahan,
      olehSiapa: String(aktor.name || aktor.id || ""),
    });

    if (!hasil.ok) {
      return ok({
        available: false,
        ok: false,
        alasan: hasil.error || "ALETA Bot belum dapat dihubungi.",
      });
    }

    return ok({ available: true, ...(hasil.data as Record<string, unknown>) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "KOSAKATA_SIMPAN_FAILED",
      feature: "aleta_bot",
      entityId: "kosakata",
    });
  }
}
