import { type NextRequest } from "next/server";

import { catatanKtpPerkara } from "@/lib/ktp-pihak-tampil";
import type { UserPersona } from "@/lib/types";
import { getDatabase } from "@/server/db/client";
import { pastikanAksiAktor } from "@/server/modules/akses/hak-peran";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { ktpPihakPerkara } from "@/server/modules/aleta-ecourt/ktp-pihak";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * TANGGAL KTP TIAP PIHAK DI STATUS PERKARA, BAGIAN PARA PIHAK (12 Okt 2026, butir 8)
 * ============================================================================
 *
 *   GET ?nomor=556/Pdt.G/2026/PA.Dgl
 *     -> { ada, pihak: [{ cabang, urutan, peran, nama, namaSipp, tanggalKtp "dd/mm/yyyy",
 *          yakin, cocok, kota, sumberBaca }], dokumenKtp, belumDibaca, tidakTerbaca,
 *          takBertuan, catatan[] }
 *
 * Sama isinya dengan rute ktp-pihak (panel ABT), tetapi:
 *   - hak lihat = aksi `status.data-pihak` (data pribadi pihak, UU PDP) seperti rute
 *     identitas-pihak/riwayat-pihak/kontak-para-pihak; 403 = bagian tidak digambar;
 *   - HANYA MEMBACA: tidak memicu pembacaan OCR (membuka Status Perkara tidak boleh
 *     menyalakan pekerjaan berat). Berkas yang belum dibaca disebut apa adanya dan dibaca
 *     penyapu latar; Admin dapat memicunya dari Integrasi e-Court.
 * NIK tidak pernah dikirim.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanKapabilitas(db, actorUserId, "panel");
    pastikanAksiAktor(aktor as UserPersona, "status.data-pihak"); // HAK-PERAN 12 Okt: matriks peran

    const nomor = String(request.nextUrl.searchParams.get("nomor") || "").trim().slice(0, 80);
    if (!nomor) return ok({ ada: false, sebab: "Nomor perkara kosong.", pihak: [], catatan: [] });

    const r = await ktpPihakPerkara(nomor, { tunggu: false });
    if (!r.ok) return ok({ ada: false, sebab: r.sebab, pihak: [], catatan: [] });
    // Tanpa tunggu: belumDibaca > 0 berarti "akan dibaca penyapu", bukan "sedang dibaca" pasti.
    return ok({ ...r.data, sedangDibaca: r.sedangDibaca, catatan: catatanKtpPerkara(r.data, r.sedangDibaca) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "KTP_PIHAK_STATUS_FAILED",
      feature: "aleta_ecourt",
      entityId: "ktp-pihak-status",
    });
  }
}
