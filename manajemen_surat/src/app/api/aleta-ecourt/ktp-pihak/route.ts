import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { ktpPihakPerkara } from "@/server/modules/aleta-ecourt/ktp-pihak";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * TANGGAL KTP TIAP PIHAK DARI BERKAS KTP e-COURT (12 Okt 2026, butir 14-15)
 * ============================================================================
 *
 *   GET ?nomor=556/Pdt.G/2026/PA.Dgl[&tunggu=1]
 *     -> { ada, pihak: [{ cabang, urutan, peran, nama, tanggalKtp "dd/mm/yyyy",
 *          yakin, cocok, kota }], dokumenKtp, belumDibaca, tidakTerbaca, takBertuan,
 *          sedangDibaca, catatan[] }
 *
 * Isinya dari tabel aleta_bot_ktp_pihak (diisi penyapu latar portal + bot, lihat
 * modules/aleta-ecourt/ktp-pihak.ts). tunggu=1: bila perkara ini masih punya
 * berkas KTP yang belum dibaca, baca sekarang (paling lama 40 detik) sebelum
 * menjawab. NIK tidak pernah dikirim. Hanya membaca - tidak ada yang ditulis ke
 * SIPP/ABT di sini (penulisnya panel ABT, sesudah petugas mencentang).
 *
 * Rute lama /ktp-terbit tetap ada bagi ekstensi lama.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const nomor = String(request.nextUrl.searchParams.get("nomor") || "").trim();
    if (!nomor) return ok({ ada: false, sebab: "Nomor perkara kosong.", pihak: [], catatan: [] });
    const tunggu = request.nextUrl.searchParams.get("tunggu") === "1";

    const r = await ktpPihakPerkara(nomor, { tunggu });
    if (!r.ok) return ok({ ada: false, sebab: r.sebab, pihak: [], catatan: [] });

    const d = r.data;
    const catatan: string[] = [];
    if (d.dokumenKtp === 0) catatan.push("Tidak ada dokumen KTP di arsip e-Court perkara ini.");
    else if (!d.ada) {
      if (d.belumDibaca > 0) {
        catatan.push(
          r.sedangDibaca
            ? `${d.belumDibaca} berkas KTP e-Court sedang/akan dibaca ALETA di latar - buka lagi sebentar lagi.`
            : `${d.belumDibaca} berkas KTP e-Court belum terbaca.`
        );
      } else if (d.tidakTerbaca > 0) catatan.push(`${d.tidakTerbaca} berkas KTP e-Court tidak terbaca (OCR/berkas) - tanggal diketik petugas.`);
      else if (d.takBertuan > 0) catatan.push("KTP terbaca, tetapi NIK/namanya tidak cocok dengan pihak mana pun di SIPP - periksa.");
      else catatan.push("Berkas KTP e-Court perkara ini belum diunduh ALETA (atau tidak disediakan e-Court).");
    }
    return ok({ ...d, sedangDibaca: r.sedangDibaca, catatan });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "KTP_PIHAK_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "ktp-pihak",
    });
  }
}
