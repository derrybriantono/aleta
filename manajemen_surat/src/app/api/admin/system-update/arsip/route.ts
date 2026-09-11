import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { NextResponse, type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  bersihkanArsip,
  buatArsip,
  keteranganArsip,
  type JenisArsip,
} from "@/server/modules/backups/arsip";
import { requireActorUser } from "@/server/modules/organization/service";
import { appendAuditLog } from "@/server/shared/audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { buildAttachmentContentDisposition, getAttachmentSecurityHeaders } from "@/server/shared/download-headers";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";
import { nextPrefixedId } from "@/server/shared/ids";
import { getSearchParam } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JENIS_SAH = new Set<JenisArsip>(["aplikasi", "pembaruan", "database"]);

/**
 * Unduhan dari Update Manager: seluruh aplikasi, paket pembaruan terbaru, dan
 * seluruh basis data.
 *
 * Tanpa `jenis`, menjawab format apa yang akan dihasilkan tiap jenis dengan
 * alat yang terpasang di peladen - supaya layar menyebut ".7z" sebelum orang
 * menekan, bukan sesudah berkasnya tiba dengan nama yang tidak ia duga.
 *
 * Hanya Super Admin. Ketiganya memuat seluruh kode atau seluruh data satuan
 * kerja; tidak ada peran lain yang punya keperluan mengunduhnya utuh.
 */
export async function GET(request: NextRequest) {
  let hasil: Awaited<ReturnType<typeof buatArsip>> | null = null;
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    if (actor.roleId !== "super-admin") {
      throw new ApiError(403, "Hanya Super Admin yang dapat mengunduh arsip aplikasi dan basis data.");
    }

    const jenis = getSearchParam(request, "jenis");
    if (!jenis) return ok(await keteranganArsip());
    if (!JENIS_SAH.has(jenis as JenisArsip)) throw new ApiError(400, "Jenis arsip tidak dikenali.");

    hasil = await buatArsip(jenis as JenisArsip, db);

    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: `EXPORT_ARSIP_${jenis.toUpperCase()}`,
      entityType: "system_backup",
      entityId: hasil.namaBerkas,
      payload: {
        format: hasil.format,
        byteLength: hasil.byteLength,
        sha256: hasil.sha256,
        catatan: hasil.catatan,
      },
    });

    // Dialirkan dari berkas, bukan dimuat utuh ke memori: arsip basis data
    // satuan kerja ini ratusan megabita sebelum dimampatkan.
    const aliran = createReadStream(hasil.jalur);
    const yangDibersihkan = hasil;
    aliran.on("close", () => {
      void bersihkanArsip(yangDibersihkan);
    });

    return new NextResponse(Readable.toWeb(aliran) as ReadableStream, {
      headers: {
        ...getAttachmentSecurityHeaders(),
        "content-type": hasil.mimeType,
        "content-length": String(hasil.byteLength),
        "content-disposition": buildAttachmentContentDisposition(hasil.namaBerkas),
        "x-aleta-arsip-format": hasil.format,
        "x-aleta-arsip-sha256": hasil.sha256,
      },
    });
  } catch (error) {
    if (hasil) await bersihkanArsip(hasil);
    return handleRouteError(error);
  }
}
