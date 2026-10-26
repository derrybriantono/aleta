import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { catatGalat, type SumberGalat } from "@/server/modules/kesehatan/galat";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Laporan per akun: paling banyak 20 per menit (di atas itu diabaikan diam-diam; pelapor tidak perlu tahu). */
const hitung = new Map<string, { menit: number; n: number }>();

/**
 * Galat dari peramban (halaman portal) dan ekstensi. Hanya akun yang sedang
 * masuk; isi dibersihkan sebelum disimpan (lihat modules/kesehatan/galat.ts).
 * Jawabannya 200 bila sesi sah, supaya penangkap di klien tidak mengulang
 * laporan yang tidak dicatat.
 */
export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    const menit = Math.floor(Date.now() / 60_000);
    const h = hitung.get(actor.id);
    if (!h || h.menit !== menit) hitung.set(actor.id, { menit, n: 1 });
    else h.n += 1;
    if ((hitung.get(actor.id)?.n ?? 0) > 20) return ok({ dicatat: false });

    const b = await readJsonBody<Record<string, unknown>>(request).catch(() => ({}) as Record<string, unknown>);
    const sumber: SumberGalat = b.sumber === "ekstensi" ? "ekstensi" : "peramban";
    const id = await catatGalat(db, {
      sumber,
      jenis: String(b.jenis ?? ""),
      pesan: String(b.pesan ?? ""),
      lokasi: String(b.lokasi ?? b.halaman ?? ""),
      halaman: String(b.halaman ?? ""),
      stack: String(b.stack ?? ""),
      akunId: actor.id,
      akunNama: actor.name ?? "",
      peramban: String(request.headers.get("user-agent") ?? ""),
      versi: String(b.versi ?? ""),
    });
    return ok({ dicatat: Boolean(id) });
  } catch (error) {
    return handleRouteError(error);
  }
}
