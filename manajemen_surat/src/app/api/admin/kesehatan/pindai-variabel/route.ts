import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { panggilBotInternal } from "@/server/modules/kesehatan/bot";
import { appendAuditLog } from "@/server/shared/audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { nextPrefixedId } from "@/server/shared/ids";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * G1 30 Okt 2026: pindai variabel Blangko Derry SEKARANG (di luar jadwal mingguan) - Super Admin (aksi "kesehatan.atur").
 * Bot menjalankannya di latar dan HANYA MEMBACA ABT/SIPP; hasilnya tampil di kartu Pusat Kesehatan sesudah selesai.
 */
export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await pastikanAksi(db, await resolveActorUserId(request), "kesehatan.atur");
    const h = await panggilBotInternal<{ dimulai?: boolean; sedangJalan?: boolean }>("/abt/pindai-variabel/jalankan", { method: "POST", body: {}, timeoutMs: 8000 });
    if (!h.ok) return ok({ dimulai: false, pesan: `Pindai belum dapat dimulai: ${h.error}` });
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "JALANKAN_PINDAI_VARIABEL",
      entityType: "aleta_ekstensi_setelan",
      entityId: "*sistem*:kesehatan:pindai-variabel",
      payload: { dimulai: h.data.dimulai === true },
    });
    return ok({ dimulai: h.data.dimulai === true, pesan: h.data.dimulai ? "Pindai dimulai; hasilnya tampil di kartu ini sesudah selesai (beberapa menit)." : "Pindai sedang berjalan." });
  } catch (error) {
    return handleRouteError(error);
  }
}
