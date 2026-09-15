import { type NextRequest } from "next/server";

import {
  type FaktaTenggat,
  nilaiTenggat,
  susunLaporanHarian,
  tanggalIso,
} from "@/lib/penjaga-tenggat";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { getGatewayPenjagaTenggat } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * AGEN PENJAGA TENGGAT (TAHAP 3) - LAPORAN HARIANNYA
 * ============================================================================
 *
 *   GET  ?acuan=yyyy-mm-dd     rapor + teks laporan WhatsApp
 *
 * Bot membaca fakta dari SIPP; rute ini yang MENILAI, memakai mesin aturan di
 * src/lib/penjaga-tenggat.ts. Pembagian yang sama dengan praperiksa putusan,
 * dan sebabnya sama: aturan yang menuduh orang lalai harus berada di tempat
 * yang penjaganya dapat menjalankannya seribu kali tanpa menyentuh SIPP.
 *
 * ============================================================================
 * RUTE INI TIDAK MENGIRIM APA PUN
 * ============================================================================
 *
 * Ia menyusun teksnya dan memulangkannya. Pengirimannya urusan terpisah, dan
 * itu disengaja: laporan yang dapat dibaca lebih dahulu adalah laporan yang
 * dapat diperbaiki sebelum seratus orang menerimanya. Agen yang menyusun DAN
 * mengirim dalam satu tarikan tidak pernah memberi kesempatan itu.
 *
 * Kewenangannya "panel" - ia hanya membaca, sama dengan layar jadwal sidang.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const acuan =
      tanggalIso(request.nextUrl.searchParams.get("acuan") || "") || tanggalIso(new Date());
    const satker = request.nextUrl.searchParams.get("satker") || "";

    const jawab = await getGatewayPenjagaTenggat(acuan);
    if (!jawab.ok) {
      // Gagal terbaca BUKAN "tidak ada tenggat". Membedakannya penting: yang
      // kedua adalah kabar baik, yang pertama adalah kabar bahwa kita tidak
      // tahu apa-apa.
      return ok({
        tersedia: false,
        acuan,
        alasan: jawab.error || "aleta_bot tidak dapat dihubungi",
      });
    }

    const mentah = (jawab.data?.fakta || {}) as Record<string, FaktaTenggat[]>;
    const rapor = nilaiTenggat(mentah, jawab.data?.acuan || acuan);
    const teks = susunLaporanHarian(rapor, { satker });

    return ok({
      tersedia: true,
      acuan: rapor.acuan,
      hitung: rapor.hitung,
      butir: rapor.butir,
      tumpukanLama: rapor.tumpukanLama,
      // Sebagian aturan dapat gagal dibaca sendiri-sendiri - tabel yang tidak
      // ada pada pemasangan tertentu, misalnya. Disebutkan apa adanya supaya
      // "tidak ada temuan" tidak tertukar dengan "tidak diperiksa".
      gagal: jawab.data?.gagal || {},
      teks,
    });
  } catch (galat) {
    return handleAdminRouteError(galat, request, {
      db,
      actorUserId,
      action: "ECOURT_PENJAGA_TENGGAT_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
