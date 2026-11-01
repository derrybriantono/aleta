import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pelakuAiBerhak, wajibSuperAdmin } from "@/server/modules/aleta-ai/akses";
import {
  bacaAturanSatker,
  hapusAturanSatker,
  isiSaldoSatker,
  pemakaianSatkerBulanIni,
  riwayatSatker,
  saldoSatker,
  simpanAturanSatker,
  verifikasiSatker,
} from "@/server/modules/aleta-ai/dompet-satker";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ALETA Ai - DOMPET SATKER (HANYA Super Admin; matriks "aleta-ai.kelola-dompet").
 *   GET    -> {saldoRp, seimbang, aturan:[{sasaran,sasaranId,boleh,batasBulananRp}], riwayat:[...], pemakaianBulanIni:[{penggunaId,peranId,terpakaiRp}]}
 *   POST   {jumlahRp, catatan?}                         -> isi saldo satker; {saldoRp}
 *   PUT    {sasaran:"peran"|"pengguna", sasaranId, boleh, batasBulananRp} -> simpan satu aturan; daftar aturan
 *   DELETE ?sasaran=&sasaranId=                         -> hapus satu aturan; daftar aturan
 * Pengguna biasa melihat dompet satker lewat /api/aleta-ai/ringkas (hak, saldo, batas bulanan miliknya sendiri).
 */
async function superAdmin(request: NextRequest) {
  const db = await getDatabase();
  const pelaku = await pelakuAiBerhak(db, await resolveActorUserId(request), "aleta-ai.kelola-dompet");
  wajibSuperAdmin(pelaku);
  return { db, pelaku };
}

export async function GET(request: NextRequest) {
  try {
    const { db } = await superAdmin(request);
    const v = await verifikasiSatker(db);
    return ok({
      saldoRp: await saldoSatker(db),
      seimbang: v.seimbang,
      aturan: await bacaAturanSatker(db),
      riwayat: await riwayatSatker(db, 100),
      pemakaianBulanIni: await pemakaianSatkerBulanIni(db),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { db, pelaku } = await superAdmin(request);
    const badan = (await request.json().catch(() => null)) as { jumlahRp?: unknown; catatan?: unknown } | null;
    if (!badan) throw new ApiError(400, "Isi permintaan tidak terbaca.");
    return ok(await isiSaldoSatker(db, pelaku.id, { jumlahRp: Number(badan.jumlahRp), catatan: String(badan.catatan ?? "") }));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { db, pelaku } = await superAdmin(request);
    const badan = (await request.json().catch(() => null)) as { sasaran?: unknown; sasaranId?: unknown; boleh?: unknown; batasBulananRp?: unknown } | null;
    if (!badan) throw new ApiError(400, "Isi permintaan tidak terbaca.");
    return ok(await simpanAturanSatker(db, pelaku.id, badan));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { db, pelaku } = await superAdmin(request);
    const url = new URL(request.url);
    return ok(await hapusAturanSatker(db, pelaku.id, url.searchParams.get("sasaran"), url.searchParams.get("sasaranId")));
  } catch (error) {
    return handleRouteError(error);
  }
}
