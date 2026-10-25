import { type NextRequest } from "next/server";

import { KATALOG_FITUR_SATKER, keadaanFitur } from "@/lib/fitur-satker";
import { getDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { bacaKonteksFitur } from "@/server/modules/satker/fitur";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Saklar Fitur Satker yang ditanyakan ekstensi: GET ?kode=a,b -> {fitur: {kode: boolean}}.
 *
 * Hanya kode yang ada di katalog Fitur Satker; kode lain dijawab false (bukan 404, supaya ekstensi lama/baru
 * tidak berbeda perilaku karena versi). Tentang pemanggilnya sendiri - cukup sudah masuk; tidak membuka data
 * perkara. Gagal membaca = jawaban mengikuti bawaan katalog (fitur bawaan MATI tetap mati).
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    await requireActorUser(db, await resolveActorUserId(request));
    const diminta = String(request.nextUrl.searchParams.get("kode") ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 30);
    const konteks = await bacaKonteksFitur(db).catch(() => ({}));
    const ada = new Set(KATALOG_FITUR_SATKER.map((f) => f.kode));
    const fitur: Record<string, boolean> = {};
    for (const kode of diminta) fitur[kode] = ada.has(kode) ? keadaanFitur(kode, konteks).menyala : false;
    return ok({ fitur });
  } catch (error) {
    return handleRouteError(error);
  }
}
