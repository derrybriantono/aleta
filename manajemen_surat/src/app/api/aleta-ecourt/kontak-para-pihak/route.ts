import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { getGatewayKontakParaPihak } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { appendAuditLog } from "@/server/shared/audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { nextPrefixedId } from "@/server/shared/ids";
import { ok } from "@/server/shared/http";
import { pastikanAksiAktor } from "@/server/modules/akses/hak-peran";
import type { UserPersona } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* === STATUS-ZIP 12 Okt === */
/**
 * ============================================================================
 * KONTAK PARA PIHAK DI STATUS PERKARA (butir 12, 12 Oktober 2026)
 * ============================================================================
 *
 *   GET ?nomor=273/Pdt.G/2026/PA.Dgl
 *     -> { ok, ada, lewatEcourt, ecourtTerbaca, orang[{ jenis, pihakKe, nama,
 *          email{nilai,sumber,lain[]}, hp{nilai,sumber,bisaWhatsApp,lain[]},
 *          elitigasi{status, label} }] }
 *
 * Email dan nomor WhatsApp/HP tiap pihak dan kuasa: SIPP dulu, lalu e-Court
 * (layanan kontak e-Court agen 5), SELALU dengan tanda sumber. "Bersedia sidang
 * elektronik (e-Litigasi)" dari persetujuan saluran elektronik e-Court
 * (aleta_bot_ecourt_pihak); yang tidak terbaca dijawab "tidak-diketahui"
 * beserta sebabnya, tidak ditebak.
 *
 * ============================================================================
 * DATA PRIBADI - DAN NILAINYA UTUH
 * ============================================================================
 *
 * Berbeda dengan identitas-pihak (NIK dan telepon disamarkan di peladen),
 * yang diminta di sini justru nomor yang dapat DIHUBUNGI - bila disamarkan,
 * fiturnya tidak berguna. Karena itu hak lihatnya dijaga di rute ini dan
 * tiap pembacaan dicatat di jejak audit (nomor perkara dan hitungannya saja,
 * TIDAK nilai kontaknya).
 *
 * HAK PER PERAN: tampil bagi peran yang menangani perkara - sama dengan
 * aksi `status.data-pihak` pada matriks peran (D:/aleta-dev/kerja/peran-12okt/
 * matriks-peran.md: Admin, Ketua/Wakil, Hakim, Panitera, Panmud, PP, JS, Kasir,
 * PTSP, Mediator, Analis; TIDAK untuk petugas sidang, kesekretariatan, TI,
 * pelaksana). Ditegakkan `pastikanAksiAktor(aktor, "status.data-pihak")`
 * (matriks peran 12 Okt) seperti rute identitas-pihak dan riwayat-pihak.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    // Sama dengan identitas-pihak/riwayat-pihak pada dasar 75e8621.
    const aktor = await pastikanKapabilitas(db, actorUserId, "panel");
    pastikanAksiAktor(aktor as UserPersona, "status.data-pihak"); // HAK-PERAN 12 Okt: matriks peran

    const nomor = String(request.nextUrl.searchParams.get("nomor") || "").trim().slice(0, 80);
    if (!nomor) {
      return ok({ available: true, ok: false, ada: false, orang: [], alasan: "Nomor perkara wajib diisi." });
    }

    const hasil = await getGatewayKontakParaPihak(nomor);
    if (!hasil.ok) {
      return ok({
        available: false,
        ok: false,
        ada: false,
        orang: [],
        alasan: hasil.error || "ALETA Bot belum dapat dihubungi, atau belum diperbarui (rute kontak-para-pihak).",
      });
    }

    const isi = hasil.data;
    const db2 = db;
    await appendAuditLog(db2, {
      id: await nextPrefixedId(db2, "audit_logs", "adt"),
      actorUserId,
      action: "ECOURT_KONTAK_PIHAK_DILIHAT",
      entityType: "perkara",
      entityId: nomor,
      // Hitungan saja - nilai email/nomor tidak pernah masuk jejak audit.
      payload: {
        nomorPerkara: nomor,
        jumlahOrang: Array.isArray(isi?.orang) ? isi.orang.length : 0,
      },
    }).catch(() => {
      // Jejak yang gagal dicatat tidak boleh membatalkan layar yang sudah terbaca.
    });

    return ok({ available: true, ...isi });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_KONTAK_PIHAK_FAILED",
      feature: "aleta_ecourt",
      entityId: "kontak-para-pihak",
    });
  }
}
/* === AKHIR STATUS-ZIP === */
