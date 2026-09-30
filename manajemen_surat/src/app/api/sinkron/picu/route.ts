import { createHash, timingSafeEqual } from "node:crypto";
import { type NextRequest } from "next/server";

import { tokenBot } from "@/server/modules/sinkron/bot-dump";
import { detakSinkron, tugasBerjalan } from "@/server/modules/sinkron/penjadwal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/sinkron/picu - satu detak penjadwal Sinkron & cadangan, untuk
 * cron host (scripts/aleta-sinkron-cron.sh) bila penjadwal di dalam portal
 * dimatikan (ALETA_SINKRON_PENJADWAL=0). Token = token internal portal-bot
 * yang sudah ada (x-aleta-internal-token); tanpa token internal terpasang,
 * rute ini selalu menolak.
 *
 * Hanya menjalankan yang JATUH TEMPO menurut pengaturan - memanggilnya tiap
 * lima menit tidak membuat cadangan tiap lima menit.
 */
export async function POST(request: NextRequest) {
  const terpasang = tokenBot();
  const diminta = request.headers.get("x-aleta-internal-token") || "";
  const sama =
    Boolean(terpasang && diminta) &&
    timingSafeEqual(createHash("sha256").update(terpasang).digest(), createHash("sha256").update(diminta).digest());
  if (!sama) return Response.json({ ok: false, error: { message: "Token internal tidak sah." } }, { status: 401 });
  if (tugasBerjalan()) return Response.json({ ok: true, data: { berjalan: tugasBerjalan() } });
  // Tidak ditunggu: satu tugas dapat berjalan puluhan menit.
  void detakSinkron();
  return Response.json({ ok: true, data: { diperiksa: true } });
}
