import { type NextRequest } from "next/server";

import { bolehRekeningPenuh, pembayaranUntukPeran, type PembayaranTampil } from "@/lib/pembayaran-ecourt";
import type { UserPersona } from "@/lib/types";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { getGatewayPembayaranEcourt } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanAksiAktor } from "@/server/modules/akses/hak-peran";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { appendAuditLog } from "@/server/shared/audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { nextPrefixedId } from "@/server/shared/ids";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* === KASIR REKENING-SKUM 3 Nov === */
/**
 * ============================================================================
 * PEMBAYARAN e-COURT PER PERKARA (Kasir 3 Nov 2026)
 * ============================================================================
 *
 *   GET ?nomor=1/Pdt.G/2026/PA.Dgl&nomor=...   (<= 80)
 *     -> { ok, penuh, perkara: { [nomor]: { diterimaDari, nomorRekening, atasNama, bank, panjar, status,
 *          tanggal, jam, nomorPendaftaranOnline, nomorPembayaran, penuh, adaSkum } } }
 *
 * Dipakai data pihak Status Perkara (kontak-para-pihak.tsx) dan kartu perkara Kasir ALETA (basmassal.js).
 *
 * HAK: peran keuangan perkara (`sidang.kasir-baca`: kasir/bendahara/analis keuangan, panitera, panitera
 * muda) dan Admin/Super Admin menerima rekening UTUH. Peran lain dengan `status.data-pihak` menerima nama
 * pembayar, bank, panjar, dan rekening TERSAMAR (****1234) - tanpa email atas-nama dan nomor pembayaran;
 * penyamaran di sini, bukan di layar. Peran lain: 403. Tiap pembacaan dicatat di jejak audit (hitungan
 * saja, bukan nilai rekening).
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = (await pastikanKapabilitas(db, actorUserId, "panel")) as UserPersona;
    const penuh = bolehRekeningPenuh(aktor);
    if (!penuh) pastikanAksiAktor(aktor, "status.data-pihak");

    const nomor = [
      ...new Set(
        request.nextUrl.searchParams
          .getAll("nomor")
          .map((n) => String(n || "").trim().slice(0, 80))
          .filter(Boolean)
      ),
    ].slice(0, 80);
    if (!nomor.length) return ok({ available: true, ok: false, penuh, perkara: {}, alasan: "Nomor perkara wajib diisi." });

    const hasil = await getGatewayPembayaranEcourt(nomor);
    if (!hasil.ok || !hasil.data || hasil.data.ok === false) {
      return ok({
        available: false,
        ok: false,
        penuh,
        perkara: {},
        alasan: "Data pembayaran e-Court belum dapat dibaca. Coba lagi beberapa saat lagi.",
      });
    }
    const perkara: Record<string, PembayaranTampil> = {};
    const kunci = (n: string) => n.replace(/\s+/g, "").toLowerCase();
    const peta = new Map(Object.entries(hasil.data.perkara || {}).map(([k, v]) => [kunci(k), v]));
    for (const n of nomor) {
      const p = peta.get(kunci(n));
      if (p) perkara[n] = pembayaranUntukPeran(p, penuh);
    }

    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId,
      action: "ECOURT_PEMBAYARAN_DILIHAT",
      entityType: "perkara",
      entityId: nomor.length === 1 ? nomor[0] : `${nomor.length} perkara`,
      // Hitungan saja - nomor rekening tidak pernah masuk jejak audit.
      payload: { jumlahDiminta: nomor.length, jumlahTerbaca: Object.keys(perkara).length, penuh },
    }).catch(() => {
      // Jejak yang gagal dicatat tidak membatalkan layar yang sudah terbaca.
    });

    return ok({ available: true, ok: true, penuh, perkara });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_PEMBAYARAN_FAILED",
      feature: "aleta_ecourt",
      entityId: "pembayaran-ecourt",
    });
  }
}
/* === AKHIR KASIR REKENING-SKUM === */
