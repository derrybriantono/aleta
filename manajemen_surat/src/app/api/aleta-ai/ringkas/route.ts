import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pelakuAi } from "@/server/modules/aleta-ai/akses";
import { pastikanAplikasiAktor } from "@/server/modules/akses/hak-peran";
import { requireActorUser } from "@/server/modules/organization/service";
import { ringkasAi } from "@/server/modules/aleta-ai/layanan";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ALETA Ai - GET /api/aleta-ai/ringkas
 * {aktif, alasanNonaktif?, saldoRp, superAdmin, pemicu:[{kode,label,kelompok,...}], proyekVersi}
 * Masuk ALETA wajib. Tidak memuat kunci API atau isi percakapan.
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const aktorId = await resolveActorUserId(request);
    const pelaku = await pelakuAi(db, aktorId);
    const ringkas = await ringkasAi(db, pelaku);
    // Alat bantu di panel Blangko Derry hanya untuk peran yang aplikasinya dibuka (Akses Menu); selain itu ditolak dengan kalimat biasa.
    let aplikasi: { aplikasiDibuka: boolean; alasanAplikasi?: string } = { aplikasiDibuka: true };
    try {
      await pastikanAplikasiAktor(db, await requireActorUser(db, aktorId), "aleta-ai");
    } catch (galat) {
      aplikasi = { aplikasiDibuka: false, alasanAplikasi: galat instanceof Error ? galat.message : "ALETA Ai belum dibuka untuk peran Anda." };
    }
    return ok({ ...ringkas, ...aplikasi, ...(aplikasi.aplikasiDibuka ? {} : { fiturBlangko: [] }) });
  } catch (error) {
    return handleRouteError(error);
  }
}
