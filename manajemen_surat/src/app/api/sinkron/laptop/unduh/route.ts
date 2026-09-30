import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { auditSinkron } from "@/server/modules/sinkron/akses";
import { berkasBundel } from "@/server/modules/sinkron/cadangan-db";
import { periksaTokenLaptop, tolakLaptop } from "@/server/modules/sinkron/laptop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/sinkron/laptop/unduh?bundel=20260930-020000&berkas=<nama>
 *
 * Hanya berkas yang tercatat di MANIFEST bundelnya yang dapat diminta - nama
 * dengan garis miring atau ".." tidak pernah menyentuh disk. Mendukung Range
 * supaya unduhan beberapa GB yang putus dilanjutkan, bukan diulang.
 * Tiap unduhan UTUH (bukan tiap potongan) dicatat di jejak audit.
 */
export async function GET(request: NextRequest) {
  const h = await periksaTokenLaptop(request);
  if (!h.ok) return tolakLaptop(h);
  const bundel = String(request.nextUrl.searchParams.get("bundel") || "");
  const nama = String(request.nextUrl.searchParams.get("berkas") || "");
  let temu: Awaited<ReturnType<typeof berkasBundel>> = null;
  try {
    temu = await berkasBundel(bundel, nama);
  } catch {
    temu = null;
  }
  if (!temu) return tolakLaptop({ status: 404, pesan: "Berkas tidak ada di bundel itu." });
  const info = await stat(temu.jalur).catch(() => null);
  if (!info) return tolakLaptop({ status: 404, pesan: "Berkas bundel sudah tidak ada di server (terpangkas?)." });

  const ukuran = info.size;
  const rentang = /^bytes=(\d+)-(\d*)$/.exec(request.headers.get("range") || "");
  let mulai = 0;
  let akhir = ukuran - 1;
  let status = 200;
  if (rentang) {
    mulai = Number(rentang[1]);
    akhir = rentang[2] ? Math.min(Number(rentang[2]), ukuran - 1) : ukuran - 1;
    if (mulai >= ukuran || mulai > akhir) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${ukuran}` } });
    }
    status = 206;
  }
  if (mulai === 0) {
    const db = await getDatabase().catch(() => null);
    await auditSinkron(db, "SINKRON_LAPTOP_UNDUH", null, {
      entityId: `${bundel}/${nama}`,
      token: h.token.id,
      label: h.token.label,
      byte: ukuran,
    });
  }
  const aliran = ukuran === 0 ? Readable.from([]) : createReadStream(temu.jalur, { start: mulai, end: akhir });
  return new Response(Readable.toWeb(aliran) as unknown as ReadableStream, {
    status,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(ukuran === 0 ? 0 : akhir - mulai + 1),
      "Content-Disposition": `attachment; filename="${encodeURIComponent(nama)}"`,
      "Accept-Ranges": "bytes",
      ...(status === 206 ? { "Content-Range": `bytes ${mulai}-${akhir}/${ukuran}` } : {}),
      "X-Aleta-Sha256": temu.berkas.sha256,
      "Cache-Control": "no-store",
    },
  });
}
