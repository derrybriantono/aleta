import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  bacaTataLetak,
  bacaTataLetakBawaan,
  hapusTataLetak,
  simpanTataLetak,
} from "@/server/modules/portal/tata-letak-dasbor";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { getSearchParam, readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Susunan kartu dasbor milik pengguna yang sedang masuk.
 *
 * ============================================================================
 * SELALU TENTANG DIRINYA SENDIRI
 * ============================================================================
 *
 * Tidak ada ruas userId pada rute ini, baik untuk membaca maupun menulis.
 * Pemiliknya selalu sesi yang mengirim permintaan. Setelan tampilan orang lain
 * tidak punya keperluan untuk dapat disentuh dari mana pun - dan jalan yang
 * tidak ada tidak perlu dijaga.
 *
 * ============================================================================
 * KEGAGALAN DI SINI TIDAK BOLEH MEMATIKAN DASBOR
 * ============================================================================
 *
 * Yang disimpan hanya urutan kartu. Karena itu sisi peramban memperlakukan
 * rute ini sebagai pelengkap: susunannya sudah tergambar dari localStorage
 * sebelum jawaban tiba, dan bila rute ini gagal, dasbor tetap utuh dengan
 * susunan yang ada. Menjadikan urutan kartu sebagai syarat tampilnya dasbor
 * akan menukar hal yang sepele dengan hal yang penting.
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const halaman = getSearchParam(request, "halaman") || "";

    // Keduanya dikirim terpisah, bukan sudah tergabung: layar perlu tahu
    // apakah pengguna ini PERNAH menyusun dasbornya sendiri - itu yang
    // menentukan tombol "Kembalikan susunan bawaan" digambar atau tidak.
    return ok({
      susunan: await bacaTataLetak(db, actor.id, halaman),
      bawaan: await bacaTataLetakBawaan(db, halaman),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Menyimpan susunan satu halaman. */
export async function PUT(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const body = await readJsonBody<{ halaman?: unknown; susunan?: unknown }>(request);

    return ok({
      susunan: await simpanTataLetak(db, actorUserId, String(body.halaman || ""), body.susunan),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * Sama dengan PUT, untuk navigator.sendBeacon.
 *
 * Suar hanya dapat mengirim POST, dan ia satu-satunya cara menyimpan susunan
 * ketika tabnya ditutup sebelum penundaan setengah detik berakhir - permintaan
 * fetch biasa dibatalkan peramban pada saat itu. Isinya sama persis, jadi
 * keduanya memanggil layanan yang sama alih-alih punya jalan tulis sendiri.
 */
export async function POST(request: NextRequest) {
  return PUT(request);
}

/** Mengembalikan satu halaman ke susunan bawaan. */
export async function DELETE(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const halaman = getSearchParam(request, "halaman") || "";

    return ok({ susunan: await hapusTataLetak(db, actorUserId, halaman) });
  } catch (error) {
    return handleRouteError(error);
  }
}
