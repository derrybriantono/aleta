import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { bersihkanNomor } from "@/server/modules/aleta-ecourt/ecourt-aksi";
import { bacaAturanPenunjukan } from "@/server/modules/aleta-ecourt/penunjukan-pengaturan";
import { postGatewayIsianBorangIkrar } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Isian borang "Data Penetapan Ikrar Talak" SIPP untuk ekstensi (31, 18 Okt 2026).
 *
 *   GET ?nomor=<nomor perkara>
 *   -> { ok: true, perlu: boolean, alasan, nilai?: { tgl_ikrar, status_penetapan, keadaan_istri, amar },
 *        simpanOtomatis: "mati" | "nyala", atasNama?, andaian? }
 *
 * MEMBACA saja - tidak menulis apa pun ke SIPP. Ekstensi yang mengisi borang di halaman SIPP
 * petugas, dan hanya bila `perlu`: sidang ikrar sudah berketerangan ikrar terlaksana dan form
 * ikrar SIPP masih kosong. `simpanOtomatis` = saklar Simpan yang sama dengan borang penetapan
 * lain (Penunjukan otomatis): mati -> petugas yang menekan Simpan. Hak aksesnya sama dengan
 * tombol tunda/putus Jadwal Sidang; yang tidak berhak dijawab `perlu: false` (ekstensi diam).
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    try {
      await pastikanKapabilitas(db, actorUserId, "panel");
      await pastikanAksi(db, actorUserId, "sidang.tunda-putus");
    } catch {
      return ok({ ok: true, perlu: false, alasan: "tidak_berhak", simpanOtomatis: "mati" });
    }

    const nomor = bersihkanNomor(request.nextUrl.searchParams.get("nomor"));
    if (!nomor) return ok({ ok: true, perlu: false, alasan: "nomor_tidak_disebut", simpanOtomatis: "mati" });

    const aturan = await bacaAturanPenunjukan(db);
    const hasil = await postGatewayIsianBorangIkrar({ nomorPerkara: nomor });
    if (!hasil.ok) {
      return ok({ ok: true, perlu: false, alasan: hasil.error || "bot_tidak_terjangkau", simpanOtomatis: aturan.simpanOtomatis });
    }
    const data = hasil.data as {
      ok?: boolean;
      alasan?: string;
      nilai?: Record<string, string>;
      atasNama?: Record<string, string>;
      andaian?: string[];
      tanggalIkrar?: string;
      jadwalId?: number;
    };
    if (data.ok !== true || !data.nilai) {
      return ok({ ok: true, perlu: false, alasan: String(data.alasan || "belum_perlu"), simpanOtomatis: aturan.simpanOtomatis });
    }
    return ok({
      ok: true,
      perlu: true,
      alasan: "",
      nilai: data.nilai,
      tanggalIkrar: data.tanggalIkrar || "",
      jadwalId: data.jadwalId || 0,
      atasNama: data.atasNama || null,
      andaian: Array.isArray(data.andaian) ? data.andaian : [],
      simpanOtomatis: aturan.simpanOtomatis,
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_IKRAR_BORANG_READ_FAILED",
      feature: "aleta_ecourt",
      entityId: "ikrar-borang",
    });
  }
}
