import { type NextRequest } from "next/server";

import { sidikNik, samarkanNik } from "@/lib/bukti-tertulis";
import { getDatabase } from "@/server/db/client";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { getGatewayArsipRincian } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/aleta-ecourt/blangko-derry/bukti-sipp?perkaraId=&nomor= - BACA SAJA (6 Nov 2026)
 *
 * Bahan pemeriksaan alat bukti tertulis di Blangko ABT by Derry dan ALETA ABT: nama dan NIK pihak serta data pernikahan dari SIPP, dan
 * daftar berkas e-Court untuk tombol pindaian. NIK utuh TIDAK keluar dari server: yang dikirim bentuk samaran dan sidik pembanding.
 * Tanpa hak data pihak: nama dan NIK tidak dikirim. Tanpa hak berkas: daftar berkas tidak dikirim. Sumber yang gagal = bagian itu kosong.
 */
type PihakBot = { nama?: string; nik?: string };
type HasilBot = { ada?: boolean; P?: PihakBot[]; T?: PihakBot[]; nikah?: { nomor?: string; tglKutipan?: string; kua?: string; tglNikah?: string } | null };

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");
    const perkaraId = String(request.nextUrl.searchParams.get("perkaraId") || "").trim();
    const nomor = String(request.nextUrl.searchParams.get("nomor") || "").trim();
    if (!/^\d+$/.test(perkaraId)) return ok({ ada: false, P: [], T: [], nikah: null, dokumen: [] });

    const bolehPihak = await pastikanAksi(db, actorUserId, "status.data-pihak").then(
      () => true,
      () => false
    );
    const bolehBerkas = await pastikanKapabilitas(db, actorUserId, "berkas").then(
      () => true,
      () => false
    );

    const j = await callAletaBotSippBridge<HasilBot>("case.buktiSipp", { perkaraId }, { timeoutMs: 10000 }).catch(() => null);
    const data = j && j.ok && j.data && j.data.ada === true ? j.data : null;
    const bersihPihak = (l: PihakBot[] | undefined) =>
      bolehPihak && Array.isArray(l)
        ? l.slice(0, 30).map((p) => ({ nama: String(p.nama || ""), nikSamar: samarkanNik(String(p.nik || "")), nikSidik: sidikNik(String(p.nik || "")) }))
        : [];

    let dokumen: Array<{ judul: string; documentKey: string }> = [];
    if (bolehBerkas && nomor) {
      const rincian = await getGatewayArsipRincian(nomor).catch(() => null);
      if (rincian && rincian.ok) {
        dokumen = (rincian.data.dokumen || [])
          .map((d) => ({ judul: String(d.judulDokumen || ""), documentKey: String(d.documentKey || "") }))
          .filter((d) => d.documentKey)
          .slice(0, 80);
      }
    }
    return ok({ ada: Boolean(data), P: bersihPihak(data?.P), T: bersihPihak(data?.T), nikah: data?.nikah ?? null, dokumen });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "BLANGKO_DERRY_BUKTI_SIPP_FAILED",
      feature: "aleta_ecourt",
      entityId: "blangko-derry-bukti-sipp",
    });
  }
}
