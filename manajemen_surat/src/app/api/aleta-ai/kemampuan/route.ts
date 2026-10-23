import { type NextRequest } from "next/server";

import { aksesDataAi, bolehKemampuanAi, DAFTAR_KEMAMPUAN_AI, KEMAMPUAN_AI } from "@/lib/matriks-peran";
import { getDatabase } from "@/server/db/client";
import { golonganPelakuAi, pelakuAi, wajibSuperAdmin } from "@/server/modules/aleta-ai/akses";
import { alatDataAktif, alatUntukPelaku } from "@/server/modules/aleta-ai/alat";
import { bacaTimpaanKemampuan, matriksBerlaku, simpanTimpaanKemampuan } from "@/server/modules/aleta-ai/kemampuan";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ALETA Ai tahap 2a - matriks kemampuan per peran (rencana v2 10.3).
 *   GET -> {kemampuan:[{kemampuan,label,boleh}], data:{perkara,relaas,rekap}, alatAktif, alat:[nama],
 *           matriks?: (Super Admin) [{kemampuan,label,golongan,bawaan}]}
 *   PUT {matriks:{<kemampuan>: golongan[] | null}} -> bentuk GET (Super Admin saja)
 * Penegakannya di server (mesin.ts & alat.ts); rute ini hanya membaca/mengubah aturannya.
 */
async function bentuk(request: NextRequest) {
  const db = await getDatabase();
  const pelaku = await pelakuAi(db, await resolveActorUserId(request));
  const timpaan = await bacaTimpaanKemampuan(db);
  const g = golonganPelakuAi(pelaku);
  return {
    db,
    pelaku,
    jawab: {
      kemampuan: DAFTAR_KEMAMPUAN_AI.map((k) => ({ kemampuan: k, label: KEMAMPUAN_AI[k].label, boleh: bolehKemampuanAi(g, k, timpaan) })),
      data: { perkara: aksesDataAi(g, "perkara", timpaan), relaas: aksesDataAi(g, "relaas", timpaan), rekap: aksesDataAi(g, "rekap", timpaan) },
      alatAktif: alatDataAktif(),
      alat: alatUntukPelaku(pelaku, timpaan).map((a) => a.name),
      ...(pelaku.superAdmin ? { matriks: matriksBerlaku(timpaan) } : {}),
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    return ok((await bentuk(request)).jawab);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const db = await getDatabase();
    const pelaku = await pelakuAi(db, await resolveActorUserId(request));
    wajibSuperAdmin(pelaku);
    const badan = (await request.json().catch(() => null)) as { matriks?: unknown } | null;
    if (!badan || typeof badan !== "object" || !badan.matriks) throw new ApiError(400, "Isi permintaan tidak terbaca.");
    await simpanTimpaanKemampuan(db, pelaku.id, badan.matriks);
    return ok((await bentuk(request)).jawab);
  } catch (error) {
    return handleRouteError(error);
  }
}
