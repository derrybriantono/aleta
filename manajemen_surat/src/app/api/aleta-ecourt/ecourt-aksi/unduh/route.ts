import { NextResponse, type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { ambilBerkasBot, catatJejakAksi, kalimatAlasan } from "@/server/modules/aleta-ecourt/ecourt-aksi";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { alamatIpPeramban } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mengunduh dokumen e-litigasi LANGSUNG dari e-Court memakai sesi e-Court
 * pengguna ini (E9). Dipakai hanya bila arsip ALETA belum punya berkasnya -
 * arsip tetap jalur pertama (/api/aleta-ecourt/berkas).
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const documentKey = String(request.nextUrl.searchParams.get("documentKey") || "").trim().slice(0, 191);
    const format = request.nextUrl.searchParams.get("format") === "word" ? "word" : "pdf";
    if (!documentKey) return NextResponse.json({ ok: false, alasan: "document_key_kosong" }, { status: 400 });

    const q = new URLSearchParams({ documentKey, format, penggunaId: actor.id, nama: actor.name });
    const respons = await ambilBerkasBot(`/ecourt-aksi/unduh?${q.toString()}`);
    const tipe = respons?.headers.get("content-type") || "";
    if (!respons || !respons.ok || /application\/json/i.test(tipe)) {
      const isiGalat = respons ? ((await respons.json().catch(() => ({}))) as { alasan?: string }) : {};
      const alasan = !respons
        ? "bot_tidak_terjangkau"
        : respons.status === 404 && !isiGalat.alasan
          ? "fitur_belum_tersedia_di_server"
          : String(isiGalat.alasan || "unduh_gagal");
      await catatJejakAksi(db, {
        penggunaId: actor.id,
        penggunaNama: actor.name,
        aksi: "unduh",
        sasaran: documentKey,
        hasil: "gagal",
        alasan,
        alamatIp: alamatIpPeramban(request),
      }).catch(() => undefined);
      return NextResponse.json({ ok: false, alasan, pesan: kalimatAlasan(alasan) }, { status: 400 });
    }
    const isi = await respons.arrayBuffer();
    await catatJejakAksi(db, {
      penggunaId: actor.id,
      penggunaNama: actor.name,
      aksi: "unduh",
      sasaran: documentKey,
      hasil: "berhasil",
      alamatIp: alamatIpPeramban(request),
    }).catch(() => undefined);
    return new Response(isi, {
      status: 200,
      headers: {
        "Content-Type": tipe || "application/octet-stream",
        "Content-Disposition": respons.headers.get("content-disposition") || "attachment",
        "Content-Length": String(isi.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_AKSI_UNDUH_FAILED",
      feature: "ecourt_aksi",
      entityId: "unduh",
    });
  }
}
