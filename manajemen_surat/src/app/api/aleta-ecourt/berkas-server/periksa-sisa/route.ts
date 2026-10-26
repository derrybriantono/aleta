import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { periksaSisaRtf } from "@/server/modules/aleta-ecourt/berkas-pekerjaan";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pemeriksa sisa blangko di server untuk SATU naskah RTF (K14, rantai B, 25 Okt 2026).
 *
 *   POST {rtfBase64} -> { tersedia, dibaca, hasil: { temuan, jumlahParagraf, jumlahHalaman, terpotong } }
 *
 * Aturannya satu: src/lib/deteksi-sisa-blangko.ts (salinan JS di ekstensi). Naskah dibaca di memori lalu dilupakan:
 * tidak disimpan di disk maupun basis data. Saklar kinerja.berkasDiServer mati -> { tersedia: false } dan ekstensi
 * memeriksa sendiri. Kewenangan: kapabilitas "blangko-abt" (sama dengan abt/pdf).
 */
export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    await pastikanKapabilitas(db, await resolveActorUserId(request), "blangko-abt");
    let b: { rtfBase64?: unknown };
    try {
      b = (await request.json()) as { rtfBase64?: unknown };
    } catch {
      throw new ApiError(400, "Badan permintaan harus JSON.");
    }
    return ok(await periksaSisaRtf(db, b || {}));
  } catch (error) {
    return handleRouteError(error);
  }
}
