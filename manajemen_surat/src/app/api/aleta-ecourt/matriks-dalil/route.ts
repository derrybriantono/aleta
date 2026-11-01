import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { sebutanAman } from "@/server/modules/aleta-ecourt/isi-gugatan";
import { depsMatriksDalil } from "@/server/modules/aleta-ecourt/isi-sipp-sumber";
import { pastikanMatriksDalil } from "@/server/modules/aleta-ecourt/matriks-dalil";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * MATRIKS DALIL SATU SUMBER (P2, 1 Nov 2026)
 * ============================================================================
 *
 *   GET ?nomor=533/Pdt.G/2026/PA.Dgl&lawan=Pemohon&pelaku=Termohon[&bentuk=ringkas]
 *     -> { ada, nomorPerkara, sumber, dihitungPada, lamaMs, dariSimpanan, basi, ringkas, dalil[], dokumen[], catatan[] }
 *
 * Dibaca panel "Peta dalil" Blangko Derry dan ekstensi lain. Matriks tersimpan per perkara (aleta_matriks_dalil); dihitung ulang
 * sendiri bila berkas e-Court baru masuk (sidik daftar berkas berubah). Permintaan pengguna tidak ditahan lebih dari 6 detik:
 * bila pembacaan ulang lebih lama, matriks lama dikembalikan (basi) dan hitungannya diteruskan di latar.
 * bentuk=ringkas: hanya hitungan (tanpa daftar dalil). Hanya membaca.
 */
const BATAS_MS = 6_000;

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");
    await pastikanAksi(db, actorUserId, "status.data-pihak");

    const q = request.nextUrl.searchParams;
    const nomor = String(q.get("nomor") || "").trim().slice(0, 80);
    if (!nomor) return ok({ ada: false, dalil: [], catatan: ["Nomor perkara kosong."] });
    const sebutan = { lawan: sebutanAman(q.get("lawan"), "Penggugat"), pelaku: sebutanAman(q.get("pelaku"), "Tergugat") };
    const h = await pastikanMatriksDalil(db, nomor, sebutan, depsMatriksDalil(db), { batasMs: BATAS_MS });
    const m = h.matriks;
    const dasar = {
      ada: h.ada,
      nomorPerkara: nomor,
      sumber: h.sumber,
      dihitungPada: h.dihitungPada,
      lamaMs: h.lamaMs,
      dariSimpanan: h.dariSimpanan,
      basi: h.basi,
      ringkas: m ? m.ringkas : null,
      catatan: h.catatan,
    };
    if (q.get("bentuk") === "ringkas") return ok(dasar);
    return ok({ ...dasar, dalil: m ? m.dalil : [], dokumen: m ? m.dokumen : [], versi: m ? m.versi : 0 });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "MATRIKS_DALIL_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "matriks-dalil",
    });
  }
}
