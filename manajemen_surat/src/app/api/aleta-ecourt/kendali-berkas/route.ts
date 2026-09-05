import { type NextRequest } from "next/server";

import { isPrivilegedAdmin } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  getGatewayKendaliKurang,
  getGatewayPutusanBermasalah,
  getGatewayKendaliRingkasan,
  mulaiGatewayKendaliSinkron,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Kendali berkas: apa yang seharusnya ada menurut SIPP, apa yang sudah ada di
 * arsip e-Court ALETA, dan apa yang kurang.
 *
 * ============================================================================
 * MEMBACA BOLEH, MENJALANKAN TIDAK
 * ============================================================================
 *
 * Melihat daftar kekurangan adalah pekerjaan sehari-hari petugas perkara -
 * justru itulah gunanya layar ini. Karena itu membaca cukup dengan kemampuan
 * panel yang sudah diatur per peran.
 *
 * MEMULAI sinkronisasi lain perkaranya: satu jalan menyapu ribuan perkara,
 * membebani SIPP selama berjam-jam, dan menolak sinkronisasi lain selama
 * berjalan. Itu tindakan pengelolaan, hanya untuk Super Admin dan Admin.
 *
 * ============================================================================
 * TIDAK MENYENTUH e-COURT SAMA SEKALI
 * ============================================================================
 *
 * Sinkronisasi ini hanya MEMBACA SIPP dan membandingkannya dengan arsip yang
 * sudah ada. Tidak satu pun halaman e-Court dibuka, sehingga tidak memerlukan
 * sesi login dan tidak dapat kehabisan sesi. Penarikan berkasnya sendiri tetap
 * lewat menu Penarikan.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const bagian = String(request.nextUrl.searchParams.get("bagian") || "ringkasan").trim();

    if (bagian === "kurang") {
      const batas = Number(request.nextUrl.searchParams.get("batas"));
      const hasil = await getGatewayKendaliKurang(Number.isFinite(batas) ? batas : 100);
      if (!hasil.ok) {
        return ok({
          available: false,
          message: hasil.error || "ALETA Bot belum dapat dihubungi.",
          perkara: [],
        });
      }
      return ok({ available: true, perkara: hasil.data?.perkara ?? [] });
    }

    // Daftar kerja putusan: perkara yang sudah diputus tetapi salinannya belum
    // terbit utuh di e-Court. Dipisahkan dari "kurang" karena tindak lanjutnya
    // berbeda - yang satu menarik berkas, yang lain mengunggah dan menanda-
    // tangani salinan putusan.
    if (bagian === "putusan") {
      const batas = Number(request.nextUrl.searchParams.get("batas"));
      const hasilPutusan = await getGatewayPutusanBermasalah(Number.isFinite(batas) ? batas : 100);
      if (!hasilPutusan.ok) {
        return ok({
          available: false,
          message: hasilPutusan.error || "ALETA Bot belum dapat dihubungi.",
          perkara: [],
        });
      }
      return ok({ available: true, perkara: hasilPutusan.data?.perkara ?? [] });
    }

    const hasil = await getGatewayKendaliRingkasan();
    if (!hasil.ok) {
      return ok({
        available: false,
        message: hasil.error || "ALETA Bot belum dapat dihubungi.",
        ringkasan: null,
      });
    }

    return ok({ available: true, ringkasan: hasil.data });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "KENDALI_BERKAS_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}

/** Tanggal yang dikirim peramban tetap diperiksa di sini, bukan dipercaya. */
function tanggalSah(nilai: unknown): string {
  const teks = String(nilai || "").trim();
  if (!teks) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(teks)) {
    throw new ApiError(400, "Tanggal harus berbentuk YYYY-MM-DD.");
  }
  return teks;
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);

    if (!isPrivilegedAdmin(actor)) {
      throw new ApiError(403, "Hanya Super Admin dan Admin yang boleh memulai sinkronisasi kendali berkas.");
    }

    const body = await readJsonBody<{
      sejak?: string;
      sampai?: string;
      maks?: number;
      hanyaEcourt?: boolean;
    }>(request);

    const sejak = tanggalSah(body?.sejak);
    const sampai = tanggalSah(body?.sampai);
    if (sejak && sampai && sejak > sampai) {
      throw new ApiError(400, "Tanggal awal melewati tanggal akhir.");
    }

    const maksMentah = Number(body?.maks);
    const maks = Number.isFinite(maksMentah) && maksMentah > 0 ? Math.floor(maksMentah) : 0;

    const hasil = await mulaiGatewayKendaliSinkron({
      sejak,
      sampai,
      maks,
      hanyaEcourt: Boolean(body?.hanyaEcourt),
      olehSiapa: `portal:${actor.email || actor.id}`,
    });

    if (!hasil.ok) {
      return ok({
        available: false,
        message: hasil.error || "ALETA Bot belum dapat dihubungi.",
      });
    }

    return ok({
      available: true,
      message: hasil.data?.pesan || "Sinkronisasi kendali berkas dimulai di latar belakang.",
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "KENDALI_BERKAS_SYNC_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
